const {
  fetchManifest,
  parseManifest,
  sanitize,
  downloadFiles,
  downloadFilesFromTxtList,
  mergeFilesLinux,
} = require("../utils");
const { join } = require("path");
const fs = require("fs/promises");

try {
  const manifest = require("./manifest.json");

  function process(episode) {
    return new Promise((resolve, reject) => {
      fetchManifest(episode.mpd_url)
        .then(async (m) => {
          //
          const parsed = await parseManifest(m);
          const adaptationSet = parsed.MPD.Period[0].AdaptationSet.find(
            (x) => x.$.contentType === "text" && x.$.lang === "en"
          );
          const representation =
            adaptationSet.Representation[0].SegmentTemplate[0];

          const baseURL = episode.mpd_url.split("stream.mpd")[0];

          const initURL = baseURL + representation.$.initialization;
          const segmentURL = baseURL + representation.$.media;

          const urls = [initURL];
          // number of segments
          const NOS = parseInt(representation.SegmentTimeline[0].S[0].$.r) + 1;
          for (var i = 1; i < NOS + 1; i++) {
            urls.push(segmentURL.replace("$Number$", i));
          }

          const txtPath = join(
            __dirname,
            "..",
            "temp",
            episode.series_title_safe,
            episode.season_shortcode,
            episode.episode_shortcode,
            "list.txt"
          );

          const segmentsDir = join(
            __dirname,
            "..",
            "temp",
            episode.series_title_safe,
            episode.season_shortcode,
            episode.episode_shortcode
          );
          await fs
            .mkdir(segmentsDir, { recursive: true })
            .then(() => console.debug("Temp dir created"))
            .catch((e) => console.error(`Failed to make temp dir! ${e}`));
          await fs
            .writeFile(txtPath, urls.join("\n"))
            .then(() => console.debug(`list file created`))
            .catch((e) => reject(`Failed to write list! ${e}`));

          await downloadFilesFromTxtList(txtPath, segmentsDir)
            .catch((e) =>
              reject(
                `Failed to download files for episode: ${episode.episode_title}! ${e}`
              )
            )
            .then(() => console.log("Download complete"));

          await fs
            .unlink(txtPath)
            .then(() => console.debug("unlinked list file"))
            .catch((e) => console.warn(`Error unlinking list file!`, e));

          const outputPath = join(
            __dirname,
            "..",
            "temp",
            episode.series_title_safe,
            episode.season_shortcode,
            `${sanitize(episode.output_name.split(".mp4")[0])}.vtt`
          );

          await mergeFilesLinux(segmentsDir, outputPath, NOS, "vtt_init.m4v")
            .then(() => console.debug("Finished merging segments!"))
            .catch((e) => reject(`Failed to merge segments! ${e}`));
          resolve();
        })
        .catch((e) => {
          reject(
            `Failed to download manifest for episode: ${episode.episode_title}! ${e}`
          );
        });
    });
  }

  (async () => {
    for (const episode of manifest) {
      console.log(`processing episode: ${episode.output_name}`);
      await process(episode)
        .then(() =>
          console.log(`Download complete for episode: ${episode.output_name}`)
        )
        .catch((e) => console.error(e));
    }
  })();
} catch {
  console.error("Failed to import manifest, it might not exist!");
  process.exit(1);
}
