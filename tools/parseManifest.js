require("better-logging")(console);
const {
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  readSync,
} = require("fs");
const { join } = require("path");
const commander = require("commander");
const { sanitize, dateDiffToString } = require("../utils");
const program = new commander.Command();
const xml2js = require("xml2js");
const fetch = require("node-fetch");

program.version("1.0.0");
program
  .option(
    "-i, --input <file name>",
    "json manifest from cbs api to parse",
    null
  )
  .option(
    "-a, --all",
    "if specified, will parse all .json files in manifests folder",
    false
  )
  .option("-d, --debug", "debug", false);

program.parse();
const options = program.opts();

if (!options.input && !options.all) {
  console.error("-i or -a not specified, at least one is required");
  process.exit(1);
}

if (options.input && options.output) {
  console.error("-i and -a cannot both be specified!");
  process.exit(1);
}

const getManifestRequestUrl = (pid) =>
  `https://link.theplatform.com/s/dJ5BDC/${pid}?format=SMIL&manifest=m3u&Tracking=true&mbr=true`;

const debug = (msg) => {
  if (options.debug) {
    console.debug(msg);
  }
};

function getMPDUrl(pid) {
  return new Promise((resolve, reject) => {
    const url = getManifestRequestUrl(pid);
    fetch(url)
      .then(async (r) => {
        if (r.status !== 200) {
          reject(r.statusText);
        } else {
          // parse
          const parser = new xml2js.Parser();
          const parsed = await parser.parseStringPromise(await r.text());

          resolve(parsed.smil.body[0].seq[0].switch[0].video[0].$.src);
        }
      })
      .catch((e) => reject(e));
  });
}

async function parseFile(data) {
  const episodes = data.result.data;
  const out = [];
  for await (const episode of episodes) {
    debug(
      `Processing episode: S${episode.season_number} E${episode.episode_number} ${episode.episode_title}`
    );
    debug(`fetching MPD for episode ${episode.episode_title}...`);
    const mpd_url = await getMPDUrl(episode.metaData.pid);
    debug(`MPD fetched for episode ${episode.episode_title}`);
    const seasonShortcode =
      episode.season_number.length > 1
        ? `S${episode.season_number}`
        : `S0${episode.season_number}`;
    const episodeShortcode =
      episode.episode_number.length > 1
        ? `E${episode.episode_number}`
        : `E0${episode.episode_number}`;
    out.push({
      series_title: episode.series_title,
      series_title_safe: sanitize(episode.series_title),
      episode_title: episode.episode_title,
      episode_title_safe: sanitize(episode.episode_title),
      episode_number: episode.episode_number,
      season_number: episode.season_number,
      season_shortcode: seasonShortcode,
      episode_shortcode: episodeShortcode,
      mpd_url,
      content_id: episode.content_id,
      output_name: sanitize(
        `${episode.series_title}.${seasonShortcode}.${episodeShortcode}.${episode.episode_title}.mp4`
      ),
      content_id: episode.content_id,
    });
  }

  return out;
}

const manifestPath = join(__dirname, "manifest.json");
if (existsSync(manifestPath)) {
  const originalManifest = readFileSync(manifestPath, {
    encoding: "utf-8",
  });
  writeFileSync(join(__dirname, "manifest.bak.json"), originalManifest);
  debug("Manifest backup created");
} else {
  debug("No manifest detected, not attempting to backup");
}

(async () => {
  const startTime = Date.now();
  const outManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, { encoding: "utf-8" }))
    : [];
  if (options.input) {
    // parse a single file
    console.log("Processing file...");
    const path = join(__dirname, "cbs-manifests", options.input);
    const manifest = readFileSync(path, { encoding: "utf-8" });
    const episodes = await parseFile(JSON.parse(manifest));
    outManifest.push(...episodes);

    writeFileSync(manifestPath, JSON.stringify(outManifest, null, 3), {
      encoding: "utf-8",
    });
    const endTime = Date.now();
    console.log(`Done. (Took ${dateDiffToString(startTime, endTime)})`);
  } else if (options.all) {
    console.log("Parsing all manifests...");
    const newEpisodes = [];
    const dirpath = join(__dirname, "cbs-manifests");
    const files = readdirSync(dirpath, { encoding: "utf-8" });
    // loop the file names
    for await (const file of files.filter((x) => x.endsWith(".json"))) {
      // file path
      const path = join(dirpath, file);
      // read the file as a string
      const manifest = readFileSync(path, { encoding: "utf-8" });
      // parse the data
      const episodes = await parseFile(JSON.parse(manifest));
      // push the data
      newEpisodes.push(...episodes);
      debug(`Parsed ${files.indexOf(file) + 1}/${files.length} files`);
    }
    outManifest.push(...newEpisodes);
    writeFileSync(manifestPath, JSON.stringify(outManifest, null, 3), {
      encoding: "utf8",
    });
    const endTime = Date.now();
    console.log(
      `Appended ${newEpisodes.length} new episodes. (Took ${dateDiffToString(
        startTime,
        endTime
      )})`
    );
  }
})();
