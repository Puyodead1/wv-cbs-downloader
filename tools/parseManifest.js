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

const debug = (msg) => {
  if (options.debug) {
    console.debug(msg);
  }
};

function parseFile(data) {
  return data.result.data.map((x) => {
    debug(
      `parsed episode: S${x.season_number} E${x.episode_number} ${x.episode_title}`
    );
    const seasonShortcode =
      x.season_number.length > 1
        ? `S${x.season_number}`
        : `S0${x.season_number}`;
    const episodeShortcode =
      x.episode_number.length > 1
        ? `E${x.episode_number}`
        : `E0${x.episode_number}`;
    return {
      series_title: x.series_title,
      series_title_safe: sanitize(x.series_title),
      episode_title: x.episode_title,
      episode_title_safe: sanitize(x.episode_title),
      episode_number: x.episode_number,
      season_number: x.season_number,
      season_shortcode: seasonShortcode,
      episode_shortcode: episodeShortcode,
      mpd_url: x.streaming_url,
      content_id: x.content_id,
      output_name: sanitize(
        `${x.series_title}.${seasonShortcode}.${episodeShortcode}.${x.episode_title}.mp4`
      ),
      content_id: x.content_id,
    };
  });
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
    const episodes = parseFile(JSON.parse(manifest));
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
      const episodes = parseFile(JSON.parse(manifest));
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
