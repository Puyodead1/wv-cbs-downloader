const commander = require("commander");
const program = new commander.Command();
const { parseLicenseResponse, decodePsshBox } = require("../utils");
const c = require("centra");
const { createConnection } = require("net");
const {
  SignedMessage,
  LicenseRequest,
  LicenseType,
  LicenseError,
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

// getLicense(options.url, options.pssh, options.auth, options.proxy)
//   .then((keys) => {
//     console.log(keys);
//   })
//   .catch((e) => console.error(e));

console.log(
  LicenseRequest.read(
    new Pbf(
      SignedMessage.read(
        new Pbf(
          Buffer.from(
            "CAEStx8SOAo2CiAiGFlPVVRVQkU6NWJmZDQ1NmMyYWJkYTBiZUjj3JWbBhABGhCRnsUISGxEhQnXIXDw7KxpGAEgrpn+ggYwFULwHgoUbGljZW5zZS53aWRldmluZS5jb20SEBcFuRfMEgSGiwYzOi93KowasBxwfCp2ZSRiuE5RypuHDHwLtVmfeohnLPzSU6Y2hBxIVegdxRABzQotxqsRTYraFkzJZGqrJGtQIYz8OKoITko2WByQKkDyRL6O5lfhVCwktC4mdfenYtjvr0tloklhzQykqmh6J807F9+rbCZLGzcpJeQgWW1flplGHUnSiLAhfOWZmP7jRbJELECee6rD9XIBGbP5Z6JgDa5CC4y9EoSjYpWCmaWVgksNVHv3uwzVwjB9GlHPet+GwRh1/GTy8bNoyjtE06MSXu/0/gSveKWnbcvMP+b3NzeBacvvi9e8P6KHe6XEoJgAZrSfmS5947kmM9NkzqPJDircUu5ALkiGepXSdYdCXhUskAGzYDWeKL6+cLJWgJ8kpqaavOKduMH1+c01pzGf2hDijWVjoTwVWWP7MfSiZIIHkkVUBZ4gQPaPDtIZ5QG9WDjDSsfDPD/JbPwrEqla4aYn5h9+jaCjExmGsowUmWzTzZqtFqPW9N2YzMhx+1RAJc2sk/El6fEzSqNTVyWGV+q2m9B89SSoT9cjD6M/tlNrgmX74u8g2xaJqKrDQnzfTgzQOv1yXhAX/RcXhW+mUWE/I7MWlDUdSoWU5u8PyzkwdCtOArztJXYOVtQ0CP+dTnDpsuk0mVKQe5FDO+nPakmoUFGqN0TYBkeiEhgkjydJfQJOw8qSTFMh01Pc9GMmlCVH/r3N5ISOkbScJ+toZZtK9MYxLLv6CtLIYogUoCGE+kIecMxUJXmEcVjdFSzbPZRvjahUs5umi5q363x6ACzD8Gjjrr768UPQRrVv5Ff7LKf87gV9qreGOQnFD7I3pyhjw3n0tjJYWYKEfeaSi6h9jv/jGPv23kFFDtcyHbYaVjefsUqXskQDMGZhzOZXS43Xvtn1foymG0W+wcltlrZwTSDE42efCV4Gpf8rOaJH0h2zqUCtU289+CsaLNOp+BkdQdWY+LJYXbOs8FZwGKQHjV4yvj3T2hAg3MvQEyzQ1wEXy3J8gHLYPdHqS6KECJAvRJVP3W1o3Wo0Bd/Np8/3Yq7/NQbXgNY/jXWKyu/N4aSMjl7Nu+9KudQb2IIG3nGszyr83c09BoBhP/4MlSFZLcwrYqLwrudYHzDE5YZqeTSYt47XmI1ZvuroBUFitZCAi7EaaZIHdT5ck7RiYC12Isu5A7szONByBtVs/VKu2GfTwejxrvP/ZcAn3bUAv8OWxGXmxPd5qMZots64PAgs3yATBFnMZtU7nNqKXBRu673UVRU6TTV/QZ49d5OkB3Mhx7HMxDqWlCeaTa/hm5x5Lcuiw2QWbdCI//lOL9gi1pDkRpJkYjeT9rG1FM5xPo7DPjNyyuxGPK3iPpkm6GHzGzYh0UnbPHHcprYtW9apHfoh1wml267yWKwYwXUcz+v8v+pvkP2O0BF2V5YRn9lWjrgcWthMCvWASAOq2zkKvB6TfPh1sHAnZtmf44n2dN2jySNo3FEGTZAnhZtgfE3mpEhn9HGLltblyZLJwq+8Tk8GIEKYBsck1P59L9VAB2pNWF/n15Ox5ywjOrZOEmrakNGWbL3O0GdLK2Yga2x73Gl0ksl7UpGdmL16eOKLfXjt6Dk9NOARvBllgSk6cRfiMK0bIVCwy8MSVCWa/lAdJS4jLfZ9Nblz/TFwHYZVMQ3BrVCIh6I29rtHHHZgU0C7jOzq5cRo+6Y8GHsznqSrYT+yq3UwnCsYRreyfY5eYTmfLTrVk3R5YJxZcld6lmc9b72Y8FS8uZqdRNpwUKj6xDPzgkoklTHk7nOP8tOo2skfMYbiMtrKhohTA7XgpcfdtpiA93yci6e1CoAmQwCCeS4w+lA4f0Vf3nRn3UnF9O4xQRw5ik7TqYvngJJJZp7/+trbsK9UYWGw3DB/5WWiI//kItnx637atv25Czt4o+q+FMTwmc4wsFDZA9qSqmAgh2g+5HbbCXm0AadGk1hkTI53f/l6GdLhJfMX/3naHG6ztE+i+TXwanJQR9JiuWi9Rs7aXIg9kxvOI+afyntkIxh5z2OeKaEGTWs8ki47q0WPIcxCDtyTgyH/FH1zR4TOs/nI+30owhieIVjWaArlGAfxLTGe3R/qlKbIcX2plK108Bm9Xedake2gZxksU3AWoQ5+mKMqRfDwjppmIzcNIBCa2MwSZD/RcI6CZxQk4LyJNLcZeCuUVwqG8fhJaPUcIVOSxuw+2N6nrX+AL7gDwe43aVRRKHBGY5t92IAyNbtEiawyvIVM5sTRqPeDs4V3WUnepp2sG5+FNn4PlVyFS2jVcoy0URRmJRbRTcDaLYFTOsDLbnzEApgDuUW3FhCXzE71btGLUo4IJDm0pquD0wpwCyFtsiI0Vkb4rbN5nyZFA1bPYrXFq+0VlTnG0AfSOTGa35nCcCbcijD9JZPWk27WAEml1OaPRElkUfwA2bZZuLvWiP3QH+Cna5e3Jd5fteXLAgQNtMcBoGN0/ePiFHyPY0dMc6/54aPHZbqxSAkLkzBNwKNfp8DTrkjF2gUYMd78OimOtl2bGuIZ1y3PeMuTYh+4YXYdzbXCxFUJ4mUbhc2tV2ckw6+mzO87JRLyRCLTbrMrwY5fon4xYeGIceIOw1nFGK3xsctBtXpAX9OKeSpOQD58QG5hz5obrSUBQ9Ug2q1FNRF0KdauGLbV8zkVQa+y6tXHkgy0omHspj43h2pYigN+2aoG5VUePBArfNCrhebM/TQrXKXIiBPukqQaFeTRFAzYlV2p6inyyiJqIIT2F3XAuf0g2NF9aU7yXGqIGYXMaPjnQDGuhgizteqTKkEJTMBtyCw2ay+JHFZFhAZYJVBT3YiA4uEipcN5GGBH95s9PQjZO6CRygE9706teq0f9OGM/I0JI/R+71/LJYTb5tJlMAiXr+rgusguZqgAo5TnTJrIMCvK2b+ngniAhb6Iu4behQyTtCu2/DAr65mKD2VkwoPd+kDS5mVq06NhM7rXFy1P7otfkjWstyuLcMekCZDQUZGBvGG5N61qQFEibq+I5X4NV+j2YIIKreVGS1e2RGcKfIOSXtVFySVR4uRwxqcdCk/xXvDSHuc+DPL/XIZHPxYikqcmeZ0kRVtdXL4QCxx9P6RD2CJtBOjCzGEnrdj5RqdlLUAuROpP1DCkJ1V465u2KSm6joh8Tfp4grKnKzi3ey8LaMwQkOtCEntJ1adNA+adACqGjSdZKnI49gplZYpT06T5SlzKeCAZlho2RtbEBxbzS1qtiNJJE3cP+rt5zLym5PiwPKAIIM/XPfPUUKrJn2A7X033oJh1/ZKvFI50IEDwWupDCducSJQzd85EgBJrBQP9UKhOZ3zluIIWAsEW7/0L/F+9Kh4vy2EzJWPA/akdGrASfj+lR3nst4C+XSqDh2AzNbbRfykFK7MmYImMig92K/t4y4CogddaHauXDPQ1+TyjJmQTLos8tZZtSZSGGGB92Vgzr8jbbbRCSxdnzKau9zwqsB7Am0d1G9Ac9ITGk+ZE3UPMTcYqguzXrEHCrlEZJXpWEvsHAKcLnypB5nNnTDpVbp1KEL7R8yi0uqu3h21Wx4lwl2+gWoz5dtkxqlA+siHDG3q9rfGshUXx9Z4Jg9StxcrU6PtP7dF2/c57FVJ7JO+32YdNG/ZPOov/5GZ6kNkzBWHwCsrh8czE1Mc1NAM1f0h/yixhfj13CqzrB49NskZRUI8Pg24IJsfmfTBXvtYAtvQKHN/wvvPZT0RTq6I7Rp3lZHCi1KFID2xUUJj3ENWSXPYzstAvWrAkV2iO9Ix2I7lEpzgqnJ9CJCpLnQcy+NDumc2tO05AMorMyTUFvUhYPPrsTLZnPyVe3N9ksuY0fm1DDmKqHetBiPdGugUekIMZtm/Ez0blQ7ApQ4pnjpPajV8rBexvg52BWPojBNCW5G93OIuNVrLQotc4p/LqKATH9nEIr5iIW8CLi1JpHT4rZcwNOwusemOMFFc20TuFM9j7Ql0APDaCcRQz5XxAYcxxkoc/xllJ68VzsS6uNkPY3wfXQG+6gafetN4eyEj5vDannS2PFYMaSDRrC6UpQiHf9GcBgxF68YtZFLQkiwWpPkhzhznOwwQxPyGOwHfcWiubQdN6FpWDHJJ3rVeAvZ2/A7uywg7/NlYyJ5Xy6GE1PsvfZJilYruoea8gK3v0mH5RQa8ldtSSLFe1isE8M3Odj9eXx7QeLryyH7dmodLjshODtKV6QPFz6E62E99kahbL85mT5o3qoIeYb5hrHy20446dKCSw0N0FOOK+8htkdRvHwaWz4HUyYVkqrPFeMPICU7rUWG9K0oTp6cHeBe0pjR3xzFrW2Y0oo8ZrCU91x+6jOw7UoQqY+DMYeG0ioCELOznn9+a3TJYGeZDTPtzqZwizHG/SjV8SgtgXNjWd5PQC3sraBPtEkziUCmfXdINkPYFuNSrDk0j7boZIHjsbFCiPZR5P3J/MjPRltVHMj0by/NmCKPl/iYelrmDKzbyDp8xiYQ8kssaeNVrLJDe2w8Imb8F3kb8GWV6GtzSCN+wGizjjf9cuVm0rPkqNrFEy7TxdNlg0TOZLds+bYH8GuZ2b1a/zq3SHg6ja5F0gtsBzWZ5r97/4C1rh9TRgnOP/H64C+c/YWvgMAYfocf5mAde+t0LYvlO0FyEK0N8Dj4Mn+X3/WVyzmhEUhlIsijzuXp5fIffDONGwvZUcVXmt8cK1nbraiT1nkwEfFi97bJe1Nj6FZhJJxlNOmxmkUaVfG5A4SSZ1mOp2esBXLtNlaKjpHcsAT39zS6qgyr6XugUzan1V1zCpQxrodBE8tCIptOkICGbBEeqNs0a0+TY3qTRQPtKkq/s94j+jJYcu57imIiIQ3AN+IaYR3S38s0Ds6YlRdiqAAjmUHBlRNQEoqyf0HXyd49j+DtKNo2dtKLqYj9fE7cwkocRYw/QSe7xpOQ0P7SY/W4/RuYJb5faryIONXGrdacw+HkyOKhWws/6AsF+o0v+f1sCfgUK+aYmvm39gY45Nzwac74GMNdZ5KWJ/sDkXS9lw/gCMdwBo39i6sltxMCwiNYj+bm/eaWhhkg/A7A/HMKU4ejNOPvptNIF5AIoupNe59Yg5hQjJXw0dSzib0KMJorAU3Y06FwZaspuGYwwol7gY9kVHJxvebgqjYlVawj5a1bU6cc96yGEWv9xPFXMTx5viMe0PeX+YFzA/lprAjcivnepfjqogSf3ZYa0oXT8agAKH5ygnEWuL0nTNRgdbM8m/QiGBG+lbpLNfVMlDGom7nBeOIIc57wbNY/fnoa6KTjdveiQBPM2x3h/AzOGpNOj6B6/IoqXytP60szdprDlny04iAoDhDqRZxCA8i63CqUpuJUZ6NAFV9IP3oaCyoI70/IHjnwhnnjo7KLNm9bICfZNYvXDqkWWwRpxCvyxb+xWEh8p7Am1H927J4xfKtJeHdgH8nL0AvSwcJZjT3GuuvehM1rNhhCyhoUJ66FxRgJU6HfKe8Rq9TYSnpdjzrJ71uytAkq3XqyncMNxY3mrAsY/cadq5+98auMGHNSNB7mcc2PWBwbEJaFoOhDwwFYSS",
            "base64"
          )
        )
      ).msg
    )
  )
);
