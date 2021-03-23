const commander = require("commander");
const program = new commander.Command();
const xml2js = require("xml2js");
const c = require("centra");
const {
  fetchManifest,
  getBestVideoRepresentation,
  getBestAudioAdaptationSet,
  getBestAudioRepresentation,
  downloadFile,
  getLicense2,
} = require("../utils");
const parser = new xml2js.Parser();

program.version("1.0.0");
program.option("-u, --url <url to mpd>", "url to mpd file");

program.parse();
const options = program.opts();

if (!options.url) {
  console.error("no url provided");
  process.exit(1);
}

fetchManifest(options.url)
  .then(async (manifestString) => {
    const manifest = await parser.parseStringPromise(manifestString);

    const adaptationSets = manifest.MPD.Period[0].AdaptationSet;
    const videoAdaptationSet = adaptationSets.find(
      (x) => x.$.mimeType === "video/mp4"
    );
    const audioAdaptationSet = adaptationSets.find(
      (x) => x.$.mimeType === "audio/mp4" && x.$.lang === "en"
    );

    const videoRepresentation = getBestVideoRepresentation(videoAdaptationSet);

    if (!videoRepresentation) {
      reject("failure getting best video representation!");
    }

    const audioRepresentation = getBestAudioRepresentation(
      audioAdaptationSet.Representation
    );
    if (!audioRepresentation) {
      reject("failure getting best audio representation!");
    }

    console.debug(
      `Best Video: ${videoRepresentation.$.width}x${videoRepresentation.$.height}`,
      `Best Audio: ${audioRepresentation.$.codecs}`
    );
    const videoURL = videoRepresentation.BaseURL[0];
    const audioURL = audioRepresentation.BaseURL[0];

    // PSSH and license requests
    const videoPssh = videoAdaptationSet.ContentProtection.find(
      (x) => x.$.schemeIdUri === "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
    )["cenc:pssh"];

    // await downloadFile(audioURL, __dirname)
    //   .then(() => console.log("audio downloaded"))
    //   .catch((e) => console.error(e));

    // await downloadFile(videoURL, __dirname)
    //   .then(() => console.log("video downloaded"))
    //   .catch((e) => console.error(e));

    const wvurl = "https://widevine-proxy.appspot.com/proxy";
    await getLicense2(videoPssh)
      .then((r) => console.log(r))
      .catch((e) => console.error(e));
  })
  .catch((e) => console.error(e));
