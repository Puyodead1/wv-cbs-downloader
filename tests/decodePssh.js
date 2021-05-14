const commander = require("commander");
const program = new commander.Command();
const { decodePsshBox } = require("../utils");
const {
  SignedMessage,
  LicenseRequest,
} = require("../protos/license_protocol.proto");
const Pbf = require("pbf");
const { WidevinePsshData } = require("../protos/widevine_pssh.proto");

program.version("1.0.0");
program.option(
  "-p, --pssh <base64 encoded pssh>",
  "file pssh in base64 encoding"
);

program.parse();
const options = program.opts();

if (!options.pssh) {
  console.error("no pssh provided");
  process.exit(1);
}

const buffer = Buffer.from(options.pssh);

console.log(decodePsshBox(buffer));
