/**
 * Reads the original CBS Manifest and looks for each episode in the expected output directory
 * Outputs a list of each episode and if the episode exists or is missing
 */
const fs = require("fs");
const path = require("path");
const commander = require("commander");
const { sanitize } = require("../utils");
const program = new commander.Command();
const chalk = require("chalk");

program.version("1.0.0");
program
  .option("-i, --input <file name>", "json manifest from cbs api to parse")
  .option(
    "-o, --output <path>",
    "path to the folder that was used as the output directory",
    null
  );

program.parse();
const options = program.opts();

if (!options.input) {
  console.error("-i not specified");
  process.exit(1);
}

if (!options.output) {
  console.warn(
    chalk.yellow(
      "output directory not specified, defaulting to current directory!"
    )
  );
  options.output = path.join(__dirname, "..", "out");
}

if (!fs.existsSync(options.output)) {
  console.error(`the output folder specifed doesnt exist! ${options.output}`);
  process.exit(1);
}

(async () => {
  const manifest = require(path.join(
    __dirname,
    "cbs-manifests",
    options.input
  ));

  console.info(
    `Processing ${manifest.result.data.length} episodes, please wait...`
  );

  const results = [];
  for await (const episode of manifest.result.data) {
    // const { seasonShortcode, outputFilename } = getOutputFilename(
    //   episode,
    //   false
    // );

    const seasonShortcode =
      episode.season_number.length > 1
        ? `S${episode.season_number}`
        : `S0${episode.season_number}`;
    const episodeShortcode =
      episode.episode_number.length > 1
        ? `E${episode.episode_number}`
        : `E0${episode.episode_number}`;

    const outputFilename = sanitize(
      `${episode.series_title}.${seasonShortcode}.${episodeShortcode}.${episode.episode_title}.mp4`
    );
    const pathToFile = path.join(
      options.output,
      sanitize(episode.series_title, undefined, true),
      seasonShortcode,
      outputFilename
    );

    // console.debug(pathToFile);

    const exists = fs.existsSync(pathToFile);
    //const msg = exists ? `${icons.success} Present` : `${icons.error} Missing`;

    results.push({
      episodeName: episode.episode_title,
      season: episode.season_number,
      episode: episode.episode_number,
      outputName: outputFilename,
      exists,
    });
  }

  console.table(
    results.map((result) => {
      return {
        Season: Number(result.season),
        Episode: Number(result.episode),
        "Episode Name": result.episodeName,
        Status: result.exists ? `√ Present` : `☓ Missing`,
      };
    })
  );
})();
