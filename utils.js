const Pbf = require("pbf");
const { WidevineCencHeader } = require("./protos/widevine_cenc_header.proto");
const { SignedMessage, License } = require("./protos/license_protocol.proto");
const c = require("centra");
const { createConnection } = require("net");
const CryptoJS = require("crypto-js");
require("cryptojs-extension/build_node/cmac");
const crypto = require("crypto").webcrypto;
const atob = require("atob");
const { spawn, execSync, exec } = require("child_process");
const rimraf = require("rimraf");
const { unlink, existsSync, mkdir } = require("fs");
const { default: axios } = require("axios");
const { join } = require("path");
const truncate = require("truncate-utf8-bytes");

var illegalRe = /[\/\?<>\\:\*\|":]/g;
var controlRe = /[\x00-\x1f\x80-\x9f]/g;
var reservedRe = /^\.+$/;
var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

function sanitize(input, replacement, replaceSpace) {
  var sanitized = input
    .replace(/\s+/g, replaceSpace ? "." : " ")
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement);
  return truncate(sanitized, 255);
}

//const DOWNLOAD_BASE = __dirname;
const DOWNLOAD_BASE = "/mnt/f/CBS";
const DOWNLOAD_DIR = join(DOWNLOAD_BASE, "temp");
const AUDIO_DIR = join(DOWNLOAD_BASE, "temp", "audio");
const VIDEO_DIR = join(DOWNLOAD_BASE, "temp", "video");
const AUDIO_ENC = join(DOWNLOAD_BASE, "temp", "audio.encrypted");
const VIDEO_ENC = join(DOWNLOAD_BASE, "temp", "video.encrypted");
const AUDIO_DEC = join(DOWNLOAD_BASE, "temp", "audio.decrypted");
const VIDEO_DEC = join(DOWNLOAD_BASE, "temp", "video.decrypted");
const OUTPUT_DIR = join(DOWNLOAD_BASE, "out");
// const OUTPUT_DIR = DOWNLOAD_BASE;
const PROXY_HOST = "10.223.33.124";
//const PROXY_HOST = "192.168.1.5";

const CHROME_RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC10dxEGINZbF0nIoMtM8705Nqm6ZWdb72DqTdFJ+UzQIRIUS59lQkYLvdQp71767vz0dVlPTikHmiv
dYHRc7Fo6JsmSUsGR3th+fU6d1Wt6cwpMTUXj/qODmubDK/ioVDW7wz9OFlSsCBvylOYp9v2+u/VXwACnBXNxCDezjx4RKcqMFT31WTxqU9OM9J86ChMOW4bFA41aLAJ
ozB+02xis7OV175XdQ5vkVXM9ys6ZoRF/K6NXeHiwcZFtMKyphXAxqU7uGY2a16bC3TEG5/km6Jru3Wxy4nKlDyUjWISwH4llWjdSi99r2c1fSCXlMCrW0CHoznn+22l
YCKtYe8JAgMBAAECggEAGOPDJvFCHd43PFG9qlTyylR/2CSWzigLRfhGsClfd24oDaxLVHav+YcIZRqpVkr1flGlyEeittjQ1OAdptoTGbzp7EpRQmlLqyRoHRpT+MxO
Hf91+KVFk+fGdEG+3CPgKKQt34Y0uByTPCpy2i10b7F3Xnq0Sicq1vG33DhYT9A/DRIjYr8Y0AVovq0VDjWqA1FW5OO9p7vky6e+PDMjSHucQ+uaLzVZSc7vWOh0tH5M
0GVk17YpBiB/iTpw4zBUIcaneQX3eaIfSCDHK0SCD6IRF7kl+uORzvWqiWlGzpdG2B96uyP4hd3WoPcZntM79PKm4dAotdgmalbueFJfpwKBgQDUy0EyA9Fq0aPF4LID
HqDPduIm4hEAZf6sQLd8Fe6ywM4p9KOEVx7YPaFxQHFSgIiWXswildPJl8Cg5cM2EyMU1tdn5xaR4VIDk8e2JEDfhPtaWskpJp2rU2wHvAXOeAES7UFMrkhKVqqVOdbo
IhlLdcYp5KxiJ3mwINSSO94ShwKBgQDavJvF+c8AINfCaMocUX0knXz+xCwdP430GoPQCHa1rUj5bZ3qn3XMwSWa57J4x3pVhYmgJv4jpEK+LBULFezNLV5N4C7vH63a
Zo4OF7IUedFBS5B508yAq7RiPhN2VOC8LRdDh5oqnFufjafF82y9d+/czCrVIG43D+KO2j4F7wKBgDg/HZWF0tYEYeDNGuCeOO19xBt5B/tt+lo3pQhkl7qiIhyO8KXr
jVilOcZAvXOMTA5LMnQ13ExeE2m0MdxaRJyeiUOKnrmisFYHuvNXM9qhQPtKIgABmA2QOG728SX5LHd/RRJqwur7a42UQ00Krlr235F1Q2eSfaTjmKyqrHGDAoGAOTrd
2ueoZFUzfnciYlRj1L+r45B6JlDpmDOTx0tfm9sx26j1h1yfWqoyZ5w1kupGNLgSsSdimPqyR8WK3/KlmW1EXkXIoeH8/8aTZlaGzlqtCFN4ApgKyqOiN44cU3qTrkhx
7MY+7OUqB83tVpqBGfWWeYOltUud6qQqV8v8LFsCgYEAnOq+Ls83CaHIWCjpVfiWC+R7mqW+ql1OGtoaajtA4AzhXzX8HIXpYjupPBlXlQ1FFfPem6jwa1UTZf8CpIb8
pPULAN9ZRrxG8V+bvkZWVREPTZj7xPCwPaZHNKoAmi3Dbv7S5SEYDbBX/NyPCLE4sj/AgTPbUsUtaiw5TvrPsFE=
-----END PRIVATE KEY-----`;

const CHROME_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtdHcRBiDWWxdJyKDLTPO9OTapumVnW+9g6k3RSflM0CESFEufZUJGC73UKe9e+u789HVZT04pB5or3WB0XOx
aOibJklLBkd7Yfn1OndVrenMKTE1F4/6jg5rmwyv4qFQ1u8M/ThZUrAgb8pTmKfb9vrv1V8AApwVzcQg3s48eESnKjBU99Vk8alPTjPSfOgoTDluGxQONWiwCaMwftNs
YrOzlde+V3UOb5FVzPcrOmaERfyujV3h4sHGRbTCsqYVwMalO7hmNmtemwt0xBuf5Juia7t1scuJypQ8lI1iEsB+JZVo3Uovfa9nNX0gl5TAq1tAh6M55/ttpWAirWHv
CQIDAQAB
-----END PUBLIC KEY-----`;

async function fetchManifest(url) {
  const res = await axios.get(url);
  return res.data;
}

async function isRSAConsistent(publicKey, privateKey) {
  // See if the data is correctly decrypted after encryption
  var testData = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
  var encryptedData = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    testData
  );
  var testDecryptedData = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedData
  );

  return areBuffersEqual(testData, testDecryptedData);
}

function areBuffersEqual(buf1, buf2) {
  if (buf1.byteLength != buf2.byteLength) return false;
  var dv1 = new Int8Array(buf1);
  var dv2 = new Int8Array(buf2);
  for (var i = 0; i != buf1.byteLength; i++) {
    if (dv1[i] != dv2[i]) return false;
  }
  return true;
}

function concatBuffers(arrays) {
  // Get the total length of all arrays.
  let length = 0;
  arrays.forEach((item) => {
    length += item.length;
  });

  // Create a new array with total length and merge all source arrays.
  let mergedArray = new Uint8Array(length);
  let offset = 0;
  arrays.forEach((item) => {
    mergedArray.set(new Uint8Array(item), offset);
    offset += item.length;
  });

  return mergedArray;
}

// CryptoJS format to byte array
function wordToByteArray(wordArray) {
  var byteArray = [],
    word,
    i,
    j;
  for (i = 0; i < wordArray.length; ++i) {
    word = wordArray[i];
    for (j = 3; j >= 0; --j) {
      byteArray.push((word >> (8 * j)) & 0xff);
    }
  }
  return byteArray;
}

// byte array to CryptoJS format
function arrayToWordArray(u8Array) {
  var words = [],
    i = 0,
    len = u8Array.length;

  while (i < len) {
    words.push(
      (u8Array[i++] << 24) |
        (u8Array[i++] << 16) |
        (u8Array[i++] << 8) |
        u8Array[i++]
    );
  }

  return {
    sigBytes: len,
    words: words,
  };
}

const toHexString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

const intToBuffer = (num) => {
  let b = new ArrayBuffer(4);
  new DataView(b).setUint32(0, num);
  return Array.from(new Uint8Array(b));
};

function PEM2Binary(pem) {
  var encoded = "";
  var lines = pem.split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf("-----") < 0) {
      encoded += lines[i];
    }
  }
  var byteStr = atob(encoded);
  var bytes = new Uint8Array(byteStr.length);
  for (var i = 0; i < byteStr.length; i++) {
    bytes[i] = byteStr.charCodeAt(i);
  }
  return bytes.buffer;
}

const getLicenseUrl = (content_id) => {
  if (!content_id || content_id === "") {
    throw new Error("Content ID not provided or was an empty string");
  }
  return `https://cbsi.live.ott.irdeto.com/widevine/getlicense?CrmId=cbsi&AccountId=cbsi&SubContentType=Default&ContentId=${content_id}`;
};

function parseLicenseResponse(licenseRequest, licenseResponse) {
  return new Promise(async (resolve, reject) => {
    licenseResponse = SignedMessage.read(new Pbf(licenseResponse));
    licenseRequest = SignedMessage.read(new Pbf(licenseRequest));
    if (
      licenseRequest.type !== SignedMessage.MessageType.LICENSE_REQUEST.value
    ) {
      reject("RESPONSE TYPE DOESNT MATCH REQUEST TYPE");
    }

    const license = License.read(new Pbf(licenseResponse.msg));

    const publicKeyEncrypt = await crypto.subtle.importKey(
      "spki",
      PEM2Binary(CHROME_RSA_PUBLIC_KEY),
      { name: "RSA-OAEP", hash: { name: "SHA-1" } },
      true,
      ["encrypt"]
    );
    const publicKeyVerify = await crypto.subtle.importKey(
      "spki",
      PEM2Binary(CHROME_RSA_PUBLIC_KEY),
      { name: "RSA-PSS", hash: { name: "SHA-1" } },
      true,
      ["verify"]
    );
    const privateKeyDecrypt = await crypto.subtle.importKey(
      "pkcs8",
      PEM2Binary(CHROME_RSA_PRIVATE_KEY),
      { name: "RSA-OAEP", hash: { name: "SHA-1" } },
      true,
      ["decrypt"]
    );

    var isRSAGood = await isRSAConsistent(publicKeyEncrypt, privateKeyDecrypt);
    if (!isRSAGood) {
      reject(
        "Can't verify RSA keys consistency; This means the public key does not match the private key!"
      );
    }

    var signatureVerifed = await crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: 20 },
      publicKeyVerify,
      licenseRequest.signature,
      licenseRequest.msg
    );
    if (!signatureVerifed) {
      reject(
        "Can't verify license request signature; either the platform is wrong or the key has changed!"
      );
    }

    var sessionKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKeyDecrypt,
      licenseResponse.session_key
    );

    // calculate context_enc
    var encoder = new TextEncoder();
    var keySize = 128;
    var context_enc = concatBuffers([
      [0x01],
      encoder.encode("ENCRYPTION"),
      [0x00],
      licenseRequest.msg,
      intToBuffer(keySize),
    ]);

    // calculate encrypt_key using CMAC
    var encryptKey = wordToByteArray(
      CryptoJS.CMAC(
        arrayToWordArray(new Uint8Array(sessionKey)),
        arrayToWordArray(new Uint8Array(context_enc))
      ).words
    );

    // iterate the keys we got to find those we want to decrypt (the content key(s))
    const keys = [];
    var contentKeys = [];
    for (currentKey of license.key) {
      if (currentKey.type != License.KeyContainer.KeyType.CONTENT.value)
        continue;

      var keyId = currentKey.id;
      var keyData = currentKey.key.slice(0, 16);
      var keyIv = currentKey.iv.slice(0, 16);

      // finally decrypt the content key
      var decryptedKey = wordToByteArray(
        CryptoJS.AES.decrypt(
          { ciphertext: arrayToWordArray(keyData) },
          arrayToWordArray(encryptKey),
          { iv: arrayToWordArray(keyIv) }
        ).words
      );

      contentKeys.push(decryptedKey);
      console.log(
        "WidevineDecryptor: Found key: " +
          toHexString(decryptedKey) +
          " (KID=" +
          toHexString(keyId) +
          ")"
      );
      keys.push({ key: toHexString(decryptedKey), kid: toHexString(keyId) });
    }

    resolve(keys);
  });
}

function requestLicenseFromServer(content_id, licenseRequest, auth) {
  return new Promise((resolve, reject) => {
    const licenseUrl = getLicenseUrl(content_id);
    c(licenseUrl, "POST")
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

async function getLicense(pssh, licenseServerAuth) {
  return new Promise((resolve, reject) => {
    console.debug(`[getLicense] Requesting License...`);
    const socket = createConnection({ host: PROXY_HOST, port: 8888 });
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

    // write pssh as a buffer to the socket
    socket.write(psshBuffer);

    socket.on("data", (licenseRequest) => {
      // close the socket
      socket.end();
      const psshData = decodePsshBox(psshBuffer);
      if (!psshData || !psshData.data || !psshData.data.content_id) {
        reject(`Invalid PSSH`);
      }

      requestLicenseFromServer(
        psshData.data.content_id,
        licenseRequest,
        licenseServerAuth
      )
        .then((keys) => {
          resolve(keys);
        })
        .catch((e) => reject(`Error fetching license from server: ${e}`));
    });
  });
}

function decodePsshBox(data) {
  const result = {};
  const decodedData = Buffer.from(data, "base64");

  // pssh header
  let psshSize = Buffer.alloc(4);
  decodedData.copy(psshSize, 0, 0, 4);
  let psshHeader = Buffer.alloc(4);
  decodedData.copy(psshHeader, 0, 4, 8);

  // fullbox header
  let headerVersion = Buffer.alloc(2);
  decodedData.copy(headerVersion, 0, 8, 10);
  let psshVersion = headerVersion.readInt16LE(0);

  let headerFlag = Buffer.alloc(2);
  decodedData.copy(headerFlag, 0, 10, 12);

  // system id
  let systemId = Buffer.alloc(16);
  decodedData.copy(systemId, 0, 12, 28);

  let dataStart = 28;
  let keyCountInt = 0;
  if (psshVersion === 1) {
    // key count
    const keyCount = Buffer.alloc(4);
    decodedData.copy(keyCount, 0, 28, 32);
    keyCountInt = keyCount.readInt32BE(0);

    if (keyCountInt > 0) {
      result.key_id = [];
      for (let i = 0; i < keyCountInt; i++) {
        // key id
        let keyId = Buffer.alloc(16);
        decodeData.copy(keyId, 0, 32 + i * 16, 32 + (i + 1) * 16);
        result.key_id.push(keyId.toString("hex"));
      }
    }
    dataStart = 32 + 16 * keyCountInt;
  }

  // data size
  const dataSize = Buffer.alloc(4);
  decodedData.copy(dataSize, 0, dataStart, dataStart + dataSize.length);
  const psshDataSize = dataSize.readInt32BE(0);

  // data
  let psshData = Buffer.alloc(psshDataSize);
  decodedData.copy(
    psshData,
    0,
    dataStart + dataSize.length,
    dataStart + dataSize.length + psshData.length
  );

  result.dataB64 = psshData.toString("base64");
  result.dataBuffer = psshData;
  result.data = decodePsshData(psshData);
  result.version = psshVersion;
  return result;
}

function decodePsshHeader(psshData) {
  return WidevineCencHeader.read(new Pbf(psshData));
}

function decodePsshData(psshData) {
  const header = decodePsshHeader(psshData);
  const wvData = {};

  if (header.key_id && header.key_id.length > 0) {
    const kids = header.key_id.map((key) => {
      return Buffer.from(key, "base64").toString("hex");
    });
    wvData.key_id = kids;
  }

  if (header.content_id) {
    wvData.content_id = Buffer.from(header.content_id, "base64").toString();
  }

  return wvData;
}

/**
 * Downloads a bunch of urls in parallel using Aria2c
 * @param {string[]} urls array of urls to download
 * @param {string} dir path to directory where files should be saved
 */
const downloadFiles = (urls, dir) => {
  return new Promise((resolve, reject) => {
    const child = spawn("aria2c", [
      "--auto-file-renaming=false",
      "-d",
      dir,
      "-Z",
      ...urls,
    ]);
    child.stdout.on("data", (data) => {
      printProgress(data.toString());
    });
    child.stderr.on("data", (data) => {
      printProgress(data.toString());
    });
    child.on("error", (err) => printProgress(err.toString()));
    child.on("message", (msg, _) => printProgress(msg));
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(`aria2c exited with code ${code}`);
      }
      resolve();
    });
  });
};

function printProgress(progress) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(progress);
}

const dateDiffToString = (a, b) => {
  let diff = Math.abs(a - b);

  let ms = diff % 1000;
  diff = (diff - ms) / 1000;
  let s = diff % 60;
  diff = (diff - s) / 60;
  let m = diff % 60;
  diff = (diff - m) / 60;
  let h = diff;

  let ss = s <= 9 && s >= 0 ? `0${s}` : s;
  let mm = m <= 9 && m >= 0 ? `0${m}` : m;
  let hh = h <= 9 && h >= 0 ? `0${h}` : h;

  return hh + ":" + mm + ":" + ss;
};

/**
 * Decrypts a file using provided key
 * @param {string} key the decryption key
 * @param {string} infile path to the encrypted file
 * @param {string} outfile path to where the decrypted file should go
 */
function decryptFile(key, infile, outfile) {
  return new Promise((resolve, reject) => {
    const child = exec(`mp4decrypt --key 1:${key} "${infile}" "${outfile}"`);
    child.on("error", (err) => {
      reject(err);
    });
    child.on("message", (msg, _) => {
      console.log(msg);
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(`mp4decrypt exited with code ${code}`);
      }

      resolve();
    });
  });
}

/**
 * Merges segments using linux cat
 * @param {string} dir path to directory that contains segments
 * @param {string} out path to merged file
 * @param {string[]} segments array of paths to files to merge
 */
function mergeFilesLinux(dir, out, segments) {
  return new Promise(async (resolve, reject) => {
    const platform = process.platform;
    if (platform !== "linux") {
      console.error(`${platform} is not supported!`);
      process.exit(1);
    }
    try {
      execSync(`cat init.m4v >> '${out}'`, {
        cwd: dir,
        encoding: "utf8",
        shell: "/bin/bash",
      });
      execSync(
        `for i in seg_{1..${segments}}.m4s; do cat "$i"; done >> '${out}'`,
        { cwd: dir, shell: "/bin/bash", encoding: "utf8" }
      );
    } catch (e) {
      reject(e);
    }

    resolve();
  });
}

/**
 * Finds the best video representation set in an array
 * @param {Representation[]} videoSet array of video representations
 * @returns best video representation
 *
 */
const getBestVideoRepresentation = (episode, videoSet) => {
  // not all manifests have a maxWidth and maxHeight
  // some only have one specific resolution but multiple bandwiths

  if (videoSet.$.maxWidth) {
    // if theres a maxWidth property, theres more than 1 resolution
    // find the highest resolution
    return videoSet.Representation.find(
      (x) =>
        x.$.width === videoSet.$.maxWidth && x.$.height === videoSet.$.maxHeight
    );
  } else {
    // theres only one resolution, we just need to find the highest bandwidth
    if (videoSet.Representation.length === 1) {
      // only one representation, just return that
      return videoSet.Representation[0];
    } else {
      // multiple representations, find highest bandwidth
      return videoSet.Representation.sort(
        (a, b) => parseInt(b.$.bandwidth) - parseInt(a.$.bandwidth)
      )[0];
    }
  }
};

/**
 * Finds the best audio representation in an array
 * @param {Representation[]} audioReps array of audio representations
 * @returns best audio representation found
 */
const getBestAudioRepresentation = (audioReps) => {
  if (audioReps.length === 1) {
    return audioReps[0];
  } else {
    return audioReps.find(
      (x) =>
        // searches by best codec first, then lowest codec, then just returns the first one it can
        episode.$.codecs === "mp4a.40.5" ||
        episode.$.codecs === "mp4a.40.2" ||
        episode.$.codecs
    );
  }
};

/**
 * Finds the best audio adaptation set in an array
 * @param {AdaptationSet[]} audioSets array of audio adaptation sets
 * @returns best audio adaptation set
 */
const getBestAudioAdaptationSet = (audioSets) => {
  //
  if (audioSets.length === 1) {
    // return the only audio set
    return audioSets.shift();
  } else {
    // multiple audio sets, find the one with the best bandwidth
    return audioSets
      .sort(
        (a, b) =>
          parseInt(getBestAudioRepresentation(b.Representation).$.bandwidth) -
          parseInt(getBestAudioRepresentation(a.Representation).$.bandwidth)
      )
      .shift();
  }
};

/**
 * Merges audio and video with FFMPEG
 * @param {string} audioPath path to audio file
 * @param {string} videoPath path to video file
 * @param {string} outputPath path to output file
 */
function mergeAV(audioPath, videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      audioPath,
      "-i",
      videoPath,
      "-c",
      "copy",
      outputPath,
    ]);
    ffmpeg.stdout.on("data", (data) => {
      console.log(data.toString());
    });
    ffmpeg.stderr.on("data", (data) => {
      console.error(data.toString());
    });
    ffmpeg.on("error", (err) => reject(err));
    ffmpeg.on("message", (msg, _) => console.log(msg));
    ffmpeg.on("exit", (code) => {
      if (code !== 0) {
        reject(`ffmpeg exited with code ${code}`);
      }

      resolve();
    });
  });
}

function makeDirectories() {
  return new Promise((resolve, _) => {
    // main download dir
    if (!existsSync(DOWNLOAD_DIR)) {
      mkdir(DOWNLOAD_DIR, (err) => {
        if (err) {
          console.error(
            `[MakeDirectories] Failed to make download directory: ${err}`
          );
        } else {
          console.log(`[MakeDirectories] Created download directory`);
        }
      });
    } else
      console.log(
        `[MakeDirectories] Download directory exists, skipping creation`
      );

    // output dir
    if (!existsSync(OUTPUT_DIR)) {
      mkdir(OUTPUT_DIR, (err) => {
        if (err) {
          console.error(
            `[MakeDirectories] Failed to make output directory: ${err}`
          );
        } else {
          console.log(`[MakeDirectories] Created output directory`);
        }
      });
    } else
      console.log(
        `[MakeDirectories] Output directory exists, skipping creation`
      );

    // audio dir
    if (!existsSync(AUDIO_DIR)) {
      mkdir(AUDIO_DIR, (err) => {
        if (err) {
          console.error(
            `[MakeDirectories] Failed to make audio directory: ${err}`
          );
        } else {
          console.log(`[MakeDirectories] Created audio directory`);
        }
      });
    } else
      console.log(
        `[MakeDirectories] Audio directory exists, skipping creation`
      );

    // video dir
    if (!existsSync(VIDEO_DIR)) {
      mkdir(VIDEO_DIR, (err) => {
        if (err) {
          console.error(
            `[MakeDirectories] Failed to make video directory: ${err}`
          );
        } else {
          console.log(`[MakeDirectories] Created video directory`);
        }
      });
    } else
      console.log(
        `[MakeDirectories] Video directory exists, skipping creation`
      );

    resolve();
  });
}

function getOutputFilename(episode, ext = false) {
  const seasonShortcode =
    episode.season_number.length > 1
      ? `S${episode.season_number}`
      : `S0${episode.season_number}`;
  const episodeShortcode =
    episode.episode_number.length > 1
      ? `E${episode.episode_number}`
      : `E0${episode.episode_number}`;
  console.debug(episode.series_title);
  console.debug(
    `${episode.series_title}.${seasonShortcode}.${episodeShortcode}.${
      episode.episode_title
    }${ext ? ".mp4" : ""}`
  );
  return {
    episodeShortcode,
    seasonShortcode,
    outputFilename: sanitize(
      `${episode.series_title}.${seasonShortcode}.${episodeShortcode}.${
        episode.episode_title
      }${ext ? ".mp4" : ""}`
    ),
  };
}

function cleanup() {
  return new Promise(async (resolve, _) => {
    unlink(AUDIO_ENC, () =>
      console.debug(`[Cleanup] Deleted encrypted audio file`)
    );
    unlink(VIDEO_ENC, () =>
      console.debug(`[Cleanup] Deleted encrypted video file`)
    );
    unlink(AUDIO_DEC, () =>
      console.debug(`[Cleanup] Deleted decrypted audio file`)
    );
    unlink(VIDEO_DEC, () =>
      console.debug(`[Cleanup] Deleted decrypted video file`)
    );
    rimraf(AUDIO_DIR, (err) => {
      if (err) {
        console.error(`[Cleanup] Failed to delete audio directory: ${err}`);
      } else {
        console.log(`[Cleanup] Deleted audio directory`);
      }
    });
    rimraf(VIDEO_DIR, (err) => {
      if (err) {
        console.error(`[Cleanup] Failed to delete audio directory: ${err}`);
      } else {
        console.log(`[Cleanup] Deleted audio directory`);
      }
    });

    resolve();
  });
}

async function calculateSegmentCount(audioTimeline, videoTimeline) {
  const result = { NOAS: 0, NOVS: 0 };

  // calculate audio segments
  for await (const s of audioTimeline) {
    if (s.$.r) {
      result.NOAS = result.NOAS + (parseInt(s.$.r) + 1);
    } else {
      result.NOAS = result.NOAS + 1;
    }
  }

  // calculate video segments
  for await (const s of videoTimeline) {
    if (s.$.r) {
      result.NOVS = result.NOVS + (parseInt(s.$.r) + 1);
    } else {
      result.NOVS = result.NOVS + 1;
    }
  }

  return result;
}

function processSegments(type, urls, NOS, key) {
  const DIR = type == "audio" ? AUDIO_DIR : VIDEO_DIR;
  const ENC = type == "audio" ? AUDIO_ENC : VIDEO_ENC;
  const DEC = type == "audio" ? AUDIO_DEC : VIDEO_DEC;

  return new Promise(async (resolve, _) => {
    const downloadStart = Date.now();
    // download all audio segments
    await downloadFiles(urls, DIR).catch((e) => console.error(e));
    const downloadEnd = Date.now();
    console.debug(
      `[SegmentDownloader] ${type} files Downloaded (took ${dateDiffToString(
        downloadStart,
        downloadEnd
      )})`
    );

    // merge segments
    console.debug(`Merging ${NOS} ${type} segments to ${ENC}...`);
    await mergeFilesLinux(DIR, ENC, NOS)
      .then(() => console.debug(`${type} segments merged`))
      .catch((e) => console.error(`Failed to merge ${type} segments: ${e}`));

    // decrypt
    console.debug(
      `Decrypting ${type} file from ${ENC} to ${DEC} with key ${key}...`
    );
    await decryptFile(key, ENC, DEC)
      .then(() => console.debug(`${type} decryption complete`))
      .catch((e) => console.error(`Error decrypting ${type}: ${e}`));

    resolve();
  });
}

module.exports = {
  decodePsshBox,
  decodePsshData,
  decodePsshHeader,
  getLicense,
  downloadFiles,
  printProgress,
  dateDiffToString,
  decryptFile,
  mergeFilesLinux,
  getBestVideoRepresentation,
  getBestAudioRepresentation,
  getBestAudioAdaptationSet,
  mergeAV,
  cleanup,
  makeDirectories,
  calculateSegmentCount,
  VIDEO_DIR,
  AUDIO_DIR,
  VIDEO_DEC,
  AUDIO_DEC,
  VIDEO_ENC,
  AUDIO_ENC,
  DOWNLOAD_BASE,
  DOWNLOAD_DIR,
  OUTPUT_DIR,
  fetchManifest,
  processSegments,
  getOutputFilename,
  sanitize: function (input, options, replaceSpace = true) {
    var replacement = (options && options.replacement) || "";
    var output = sanitize(input, replacement, replaceSpace);
    if (replacement === "") {
      return output;
    }
    return sanitize(output, "");
  },
};
