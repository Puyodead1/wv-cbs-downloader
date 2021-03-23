require("better-logging")(console);
const {
  getBestAudioAdaptationSet,
  getBestAudioRepresentation,
  getBestVideoRepresentation,
  fetchManifest,
  dateDiffToString,
  makeDirectories,
  calculateSegmentCount,
  getLicense,
  VIDEO_DEC,
  AUDIO_DEC,
  OUTPUT_DIR,
  processSegments,
  mergeAV,
  cleanup,
  getOutputFilename,
} = require("./utils");
const xml2js = require("xml2js");
const { join } = require("path");
const { existsSync, mkdirSync } = require("fs");

const LICENSE_SERVER_AUTH =
  "Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IjNkNjg4NGJmLWViMDktNDA1Zi1hOWZjLWU0NGE1NmY3NjZiNiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MjQzNjIzM19VUyIsImVudCI6W3siYmlkIjoiQWxsQWNjZXNzTWFpbiIsImVwaWQiOjl9XSwiaWF0IjoxNjE2MTkzNjE0LCJleHAiOjE2MTYyMDA4MTQsImlzcyI6ImNicyIsImFpZCI6ImNic2kiLCJqdGkiOiJlZDBjNzFiMy03NGQ5LTQ5NGYtYjI1MC1jNTU5YzEzOTJjYmYifQ.mqpgV3d8R07GxbMmziHGxJJuNu2B6wkEEgEDrP4Jos4";

function processEpisode(episode) {
  return new Promise(async (resolve, reject) => {
    // fetch manifest
    await fetchManifest(episode.mpd_url)
      .then(async (manifestString) => {
        try {
          const parser = new xml2js.Parser();
          const manifest = await parser.parseStringPromise(manifestString);

          const adaptationSets = manifest.MPD.Period[0].AdaptationSet;
          const videoAdaptationSet = adaptationSets.find(
            (x) => x.$.contentType === "video"
          );
          const audioAdaptationSets = adaptationSets.filter(
            (x) => x.$.contentType === "audio" && x.$.lang === "en"
          );

          const videoRepresentation = getBestVideoRepresentation(
            videoAdaptationSet
          );

          if (!videoRepresentation) {
            reject("failure getting best video representation!");
          }

          const bestAudioAdaptationSet = getBestAudioAdaptationSet(
            audioAdaptationSets
          );
          if (!bestAudioAdaptationSet) {
            reject("failure getting best audio adaptation set!");
          }
          const audioRepresentation = getBestAudioRepresentation(
            bestAudioAdaptationSet.Representation
          );
          if (!audioRepresentation) {
            reject("failure getting best audio representation!");
          }

          console.debug(
            `Best Video: ${videoRepresentation.$.height}x${videoRepresentation.$.width}`,
            `Best Audio: ${audioRepresentation.$.codecs}`
          );

          await makeDirectories();
          const baseURL = episode.mpd_url.split("stream.mpd")[0];
          const audioInit =
            audioRepresentation.SegmentTemplate[0].$.initialization;
          const videoInit =
            videoRepresentation.SegmentTemplate[0].$.initialization;
          const audioMedia = audioRepresentation.SegmentTemplate[0].$.media;
          const videoMedia = videoRepresentation.SegmentTemplate[0].$.media;

          const audioPssh = bestAudioAdaptationSet.ContentProtection.find(
            (x) =>
              x.$.schemeIdUri ===
              "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
          )["cenc:pssh"][0];

          const videoPssh = videoAdaptationSet.ContentProtection.find(
            (x) =>
              x.$.schemeIdUri ===
              "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
          )["cenc:pssh"][0];

          const samePssh = audioPssh === videoPssh;
          console.debug(`[Processor] Same Pssh?: ${samePssh}`);
          var keys = { audio: null, video: null };
          if (samePssh) {
            // we only need to request one license since its the same for both tracks
            const keyResponse = await getLicense(
              audioPssh,
              LICENSE_SERVER_AUTH
            ).catch((e) =>
              reject(`[getLicense] Error requesting license (single): ${e}`)
            );
            if (!keyResponse) reject();
            keys = { audio: keyResponse[0], video: keyResponse[0] };
          } else {
            // audio and video tracks use difference licenses, so we need to request them both

            // audio
            const audioKeyResponse = await getLicense(
              audioPssh,
              LICENSE_SERVER_AUTH
            ).catch((e) =>
              reject(
                `[getLicense] Error requesting license (multi; audio): ${e}`
              )
            );
            if (!audioKeyResponse) reject();
            console.debug(`[License] (Multi) Audio license fetched!`);

            // video
            const videoKeyResponse = await getLicense(
              videoPssh,
              LICENSE_SERVER_AUTH
            ).catch((e) =>
              reject(
                `[getLicense] Error requesting license (multi; video): ${e}`
              )
            );
            if (!videoKeyResponse) reject();
            console.debug(`[License] (Multi) Video license fetched!`);

            keys = { audio: audioKeyResponse[0], video: videoKeyResponse[0] };
          }

          const audioTimeline =
            audioRepresentation.SegmentTemplate[0].SegmentTimeline[0].S;
          const videoTimeline =
            videoRepresentation.SegmentTemplate[0].SegmentTimeline[0].S;

          const { NOAS, NOVS } = await calculateSegmentCount(
            audioTimeline,
            videoTimeline
          );

          console.debug(
            `Calculated '${NOAS}' audio segments and '${NOVS}' video segments`
          );

          const audioUrls = [`${baseURL}${audioInit}`];

          // using NOVS here because its usually always correct
          for (var i = 1; i < NOVS + 1; i++) {
            audioUrls.push(`${baseURL}${audioMedia.replace("$Number$", i)}`);
          }

          const videoUrls = [`${baseURL}${videoInit}`];

          for (var i = 1; i < NOVS + 1; i++) {
            videoUrls.push(`${baseURL}${videoMedia.replace("$Number$", i)}`);
          }

          // process audio and video segments, this includes downloading, merging, and decrypting
          await processSegments("audio", audioUrls, NOAS, keys.audio.key);
          await processSegments("video", videoUrls, NOVS, keys.video.key);

          console.debug(
            `[Proccessor] All segments have been downloaded, merged and decrypted, merging AV...`
          );

          // final output path of merged AV
          const SERIES_OUTPUT_PATH = join(
            OUTPUT_DIR,
            episode.series_title_safe,
            episode.season_number.length > 1
              ? `S${episode.season_number}`
              : `S0${episode.season_number}`
          );

          // create dir if not exists
          if (!existsSync(SERIES_OUTPUT_PATH)) {
            mkdirSync(SERIES_OUTPUT_PATH, { recursive: true });
            console.debug(
              `[Processor] Created output directory at ${SERIES_OUTPUT_PATH}`
            );
          } else {
            console.debug(
              `[Processor] Output directory already exists, skipping creation`
            );
          }

          // merge av
          await mergeAV(
            AUDIO_DEC,
            VIDEO_DEC,
            join(SERIES_OUTPUT_PATH, episode.output_name)
          ).catch((e) => console.error(`[MergeAV] Error merging AV: ${e}`));
          console.debug("[Processor] AV Merge complete, cleaning up...");
          await cleanup();
          console.debug("[Processor] Cleanup complete.");
          resolve();
        } catch (e) {
          reject(e);
        }
      })
      .catch((e) => reject(`Failed to download episode manifest: ${e}`));
  });
}

(async () => {
  // load manifest
  const manifest = require("./tools/manifest.json");
  const platform = process.platform;
  const node_version = process.version;
  // ensure correct platform
  if (platform !== "linux") {
    console.error(`${platform} is not supported!`);
    process.exit(1);
  }

  // ensure correct node version
  if (node_version.split(".")[0] !== "v15") {
    console.error(
      `Node.JS version '${node_version}' is not supported! Please use Node.JS version 15+!`
    );
    process.exit(1);
  }

  const TEST_MODE = false;
  const failed = [];
  if (!TEST_MODE) {
    for await (const episode of manifest) {
      console.debug(
        `Processing episode ${episode.output_name.split(".mp4")[0]}`
      );
      const start = Date.now();
      await processEpisode(episode).catch((e) => {
        console.error(`Error processing episode: ${e}`);
        failed.push(episode);
      });
      const end = Date.now();
      console.debug(
        `Finished processing episode ${
          episode.output_name
        } in ${dateDiffToString(start, end)}`
      );
    }
  } else {
    const episode = manifest[Math.floor(Math.random() * manifest.length)];
    console.debug(`Processing episode ${episode.output_name.split(".mp4")[0]}`);
    const start = Date.now();
    await processEpisode(episode).catch((e) => console.error(e));
    const end = Date.now();
    console.debug(
      `Finished processing episode ${
        episode.output_name.split(".mp4")[0]
      } in ${dateDiffToString(start, end)}`
    );
  }
})();
