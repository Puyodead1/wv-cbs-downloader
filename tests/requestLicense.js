const commander = require("commander");
const program = new commander.Command();
const { parseLicenseResponse, decodePsshBox } = require("../utils");
const c = require("centra");
const { createConnection } = require("net");
const {
  SignedMessage,
  LicenseRequest,
} = require("../protos/license_protocol.proto");
const Pbf = require("pbf");
const { WidevinePsshData } = require("../protos/widevine_pssh.proto");

program.version("1.0.0");
program
  .option("-p, --pssh <base64 encoded pssh>", "file pssh in base64 encoding")
  .option("-l, --url <url>", "url of license server")
  .option("-p, --proxy <ip>", "proxy ip", "127.0.0.1")
  .option("-a, --auth <auth>", "header auth for license server", undefined);

program.parse();
const options = program.opts();

if (!options.pssh) {
  console.error("no pssh provided");
  process.exit(1);
}

if (!options.url) {
  console.error("no license server url specified");
  process.exit(1);
}

function requestLicenseFromServer(url, licenseRequest, auth) {
  return new Promise((resolve, reject) => {
    console.log(
      url,
      LicenseRequest.read(
        new Pbf(SignedMessage.read(new Pbf(licenseRequest)).msg)
      )
    );
    c(url, "POST")
      .header("authorization", auth)
      .body(licenseRequest, "buffer")
      .send()
      .then(async (r) => {
        if (r.statusCode != 200) {
          reject(`Status code was ${r.statusCode}; ${r.body.toString()}`);
        } else {
          parseLicenseResponse(licenseRequest, r.body)
            .then((keys) => resolve(keys))
            .catch((e) => reject(e));
        }
      })
      .catch((e) => {
        reject(e);
      });
  });
}

async function getLicense(url, pssh, licenseServerAuth, proxy) {
  return new Promise((resolve, reject) => {
    console.debug(`[getLicense] Requesting License...`);
    const socket = createConnection({ host: proxy, port: 8888 });
    socket.on("error", (err) => {
      socket.end();
      reject(`License Proxy Error: ${err}`);
    });
    socket.on("timeout", () => {
      socket.end();
      reject(`License Proxy Timeout`);
    });

    // create buffer from pssh
    const psshBuffer = Buffer.from(pssh, "base64");

    const psshData = decodePsshBox(psshBuffer);
    if (!psshData || !psshData.data) {
      reject(`Invalid PSSH`);
    }

    // write pssh as a buffer to the socket
    socket.write(psshBuffer);

    socket.on("data", (licenseRequest) => {
      // close the socket
      socket.end();

      console.log("Recieved license request!");
      console.log(
        LicenseRequest.read(
          new Pbf(SignedMessage.read(new Pbf(licenseRequest)).msg)
        )
      );
      requestLicenseFromServer(url, licenseRequest, licenseServerAuth)
        .then((keys) => {
          resolve(keys);
        })
        .catch((e) => reject(`Error fetching license from server: ${e}`));
    });
  });
}

getLicense(options.url, options.pssh, options.auth, options.proxy)
  .then((keys) => {
    console.log(keys);
  })
  .catch((e) => console.error(e));
