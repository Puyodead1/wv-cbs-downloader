## STOP! USE OF ANY SCRIPTS IN THIS REPOSITORY IS AT YOUR OWN RISK, I AM NOT RESPONSIBLE FOR YOU GETTING IN LEGAL TROUBLE! THESE SCRIPTS ARE ONLY PUBLIC FOR EDUCATIONAL PURPOSES! I HIGHLY SUGGEST YOU LEAVE THIS STUFF ALONE!!!!!

# I AM NOT PROVIDING SUPPORT FOR THIS

## Note
- There may be expired bearer tokens left behind and random test code files, this is because I didn't initally intent to open source this repository.
- **This won't work after May 31, 2021 due to Widevine removing support for old CDM versions.**

# What the fuck is this?

utility scripts written in nodejs to assist in a rather not-so-legal activity known as piracy, its specifically make for CBS all access

## Requirements

- nodejs 15+ (V15 is required for the WebCrypto API)
- linux (developed against ubuntu, only required because of the cat command)
- ffmpeg
- Bento4 (specifically mp4decrypt)
- decent amount of free hard drive space, at least 8-16gb (a single 1080p episode is around 1.5-2gb, with 720p being close behind that)

# How to use

### step 1 - get series season information (aka metadata)

using the network inspector of an internet browser, find the XHR request to the cbs api for a series season information
example:

```
https://www.cbs.com/shows/swat/xhr/episodes/page/0/size/18/xs/0/season/4/
```

this returns a json object with all the information of all the episodes in the requested season of a series

there are 2 ways to achieve what we need with this data, you can either copy the response and make a file called something like `<series title>.<season number>.json` and paste the json object into it
or
you can just save the response as a json file directly

### step 2 - parse metadata/extract information we want

Next we need to extract the information we want, this includes the series title, the season number, the episode number, and the manifest url (aka stream_url)
there is a script provided which does just this called `parseManifest.js`

```
Usage: parseManifest [options]

Options:
  -V, --version            output the version number
  -i, --input <file name>  json manifest from cbs api to parse (default: null)
  -d, --debug              debug (default: false)
  -h, --help               display help for command
```

example:
`node parseManifest -i swat.s04.json`
this would load the manifest titled `swat.s04.json` from the `cbs-manifests` folder

### step 3 - download

now that you have all the required information, you can start the download
`node index.js` or `node .`

what the `index.js` script does:

- loops each episode
- requests stream manifest
- parses stream manifest xml as json
- extracts best audio and video
- extracts PSSH of audio and video
- requests license keys for audio and video (audio and video tracks can sometimes use the same key, in which case only one key is requested)
- calculates number of segments
- starts downloading all audio segments
- merges all audio segments into a single encrypted file
- decrypts audio file
- downloads all video segments
- merges video segments
- decrypts video file
- merges audio and video into a single final mp4
- deletes encrypted audio and video files, decrypted audio and video files and all audio and video segments (tl;dr: cleans up temp files)

# Other tool information

## downloadVerifier:

downloadVerifier.js is a tool used to quickly verify if episodes from a series are downloaded or not, just pass the name of the CBS Manifest JSON and the output will be a nicely formatted table.

Usage:

```
Usage: downloadVerifier [options]

Options:
  -V, --version            output the version number
  -i, --input <file name>  json manifest from cbs api to parse
  -o, --output <path>      path to the folder that was used as the output directory (default: null)
  -h, --help               display help for command
```

Example output (all success results):

```
output directory not specified, defaulting to current directory!
Processing 22 episodes, please wait...
┌─────────┬────────┬─────────┬───────────────────────────────────────┬─────────────┐
│ (index) │ Season │ Episode │             Episode Name              │   Status    │
├─────────┼────────┼─────────┼───────────────────────────────────────┼─────────────┤
│    0    │   3    │    1    │              'Improvise'              │ '√ Present' │
│    1    │   3    │    2    │  'Bravo Lead + Loyalty + Friendship'  │ '√ Present' │
│    2    │   3    │    3    │   'Bozer + Booze + Back to School'    │ '√ Present' │
│    3    │   3    │    4    │         'Guts + Fuel + Hope'          │ '√ Present' │
│    4    │   3    │    5    │ 'Dia de Muertos + Sicarios + Family'  │ '√ Present' │
│    5    │   3    │    6    │     'Murdoc + MacGyver + Murdoc'      │ '√ Present' │
│    6    │   3    │    7    │ 'Scavengers + Hard Drive + Dragonfly' │ '√ Present' │
│    7    │   3    │    8    │  'Revenge + Catacombs + Le Fantome'   │ '√ Present' │
│    8    │   3    │    9    │   'Specimen 234 + PAPR + Outbreak'    │ '√ Present' │
│    9    │   3    │   10    │      'Matty + Ethan + Fidelity'       │ '√ Present' │
│   10    │   3    │   11    │        'Mac + Fallout + Jack'         │ '√ Present' │
│   11    │   3    │   12    │  'Fence + Suitcase + Americium-241'   │ '√ Present' │
│   12    │   3    │   13    │  'Wilderness + Training + Survival'   │ '√ Present' │
│   13    │   3    │   14    │      'Father + Bride + Betrayal'      │ '√ Present' │
│   14    │   3    │   15    │    'K9 + Smugglers + New Recruit'     │ '√ Present' │
│   15    │   3    │   16    │        'Lidar + Rogues + Duty'        │ '√ Present' │
│   16    │   3    │   17    │    'Seeds + Permafrost + Feather'     │ '√ Present' │
│   17    │   3    │   18    │        'Murdoc + Helman + Hit'        │ '√ Present' │
│   18    │   3    │   19    │     'Friends + Enemies + Border'      │ '√ Present' │
│   19    │   3    │   20    │    'No-Go + High-Voltage + Rescue'    │ '√ Present' │
│   20    │   3    │   21    │     'Treason + Heartbreak + Gum'      │ '√ Present' │
│   21    │   3    │   22    │       'Mason + Cable + Choices'       │ '√ Present' │
└─────────┴────────┴─────────┴───────────────────────────────────────┴─────────────┘
```

Example output 2 (mixed results):

```
Processing 14 episodes, please wait...
┌─────────┬────────┬─────────┬─────────────────────────────────┬─────────────┐
│ (index) │ Season │ Episode │          Episode Name           │   Status    │
├─────────┼────────┼─────────┼─────────────────────────────────┼─────────────┤
│    0    │   2    │    1    │            'Brother'            │ '√ Present' │
│    1    │   2    │    2    │           'New Eden'            │ '√ Present' │
│    2    │   2    │    3    │        'Point of Light'         │ '√ Present' │
│    3    │   2    │    4    │      'An Obol For Charon'       │ '√ Present' │
│    4    │   2    │    5    │    'Saints of Imperfection'     │ '☓ Missing' │
│    5    │   2    │    6    │     'The Sound of Thunder'      │ '☓ Missing' │
│    6    │   2    │    7    │       'Light and Shadows'       │ '☓ Missing' │
│    7    │   2    │    8    │       'If Memory Serves'        │ '☓ Missing' │
│    8    │   2    │    9    │       'Project Daedalus'        │ '☓ Missing' │
│    9    │   2    │   10    │         'The Red Angel'         │ '☓ Missing' │
│   10    │   2    │   11    │      'Perpetual Infinity'       │ '☓ Missing' │
│   11    │   2    │   12    │ 'Through the Valley of Shadows' │ '☓ Missing' │
│   12    │   2    │   13    │       'Such Sweet Sorrow'       │ '☓ Missing' │
│   13    │   2    │   14    │   'Such Sweet Sorrow, Part 2'   │ '☓ Missing' │
└─────────┴────────┴─────────┴─────────────────────────────────┴─────────────┘
```

NOTE: the X (cross) unicode character for 'Missing' doesn't seem to appear correctly on the default windows Command Prompt, but it does work correctly when using Windows Terminal Preview
