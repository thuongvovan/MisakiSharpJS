# MisakiSharp WASM

Prebuilt browser distribution of [MisakiSharp](https://github.com/Lyrcaxis/MisakiSharp), a multilingual grapheme-to-phoneme engine for Kokoro TTS and other speech applications.

This repository is a standalone JavaScript library. Applications that consume it do not need the .NET SDK, the C# source repository, or a server-side runtime. The npm package includes the JavaScript API, TypeScript declarations, Web Worker, and .NET WebAssembly runtime. Compressed language data is published as GitHub Release assets and downloaded lazily from their versioned browser mirror.

## Features

- Promise-based ES module API with TypeScript declarations.
- Web Worker execution by default so G2P work does not block the browser UI.
- WebAssembly AOT release build.
- Lazy loading and caching of versioned language data.
- Single-call batch processing across the JavaScript/WASM boundary.
- Separate asset and data URLs for static hosting or CDN deployment.
- English, Japanese, Chinese, Spanish, French, Hindi, Italian, and Portuguese.

## Install

Install directly from the GitHub repository. Pin a tag or commit for reproducible builds:

```sh
npm install github:thuongvovan/MisakiSharpJS#v2.2.0
```

Use the latest `main` branch during development:

```sh
npm install github:thuongvovan/MisakiSharpJS#main
```

The equivalent `package.json` dependency is:

```json
{
  "dependencies": {
    "misakisharp-wasm": "github:thuongvovan/MisakiSharpJS#main"
  }
}
```

Install this local checkout:

```sh
npm install /absolute/path/to/MisakiSharpJS
```

Or install a generated tarball:

```sh
npm install /absolute/path/to/misakisharp-wasm-2.2.0.tgz
```

## Quick start

```js
import { createMisaki } from "misakisharp-wasm";

const misaki = await createMisaki({
  preload: ["ja"],
});

const phonemes = await misaki.phonemize(
  "日本語は面白い！",
  "ja",
);

console.log(phonemes);
misaki.dispose();
```

The default language is `en-us`. Supported language codes are:

```text
en-us, en-gb, ja, zh, zh-legacy, es, fr-fr, hi, it, pt-br
```

## Batch processing

Use `phonemizeBatch` when several strings use the same language. It crosses the JavaScript/WASM boundary once and reuses the cached language engine.

```js
const results = await misaki.phonemizeBatch(
  ["Hello world.", "WebAssembly keeps the interface responsive."],
  "en-us",
);
```

## API

### `createMisaki(options?)`

Creates and initializes a client.

| Option | Default | Description |
|---|---|---|
| `worker` | `true` | Run the runtime in a Web Worker. Set to `false` only when main-thread execution is acceptable. |
| `assetBaseUrl` | Directory containing `misaki.js` | Public directory containing `misaki.worker.js` and `_framework/`. |
| `dataBaseUrl` | Release's versioned browser mirror | Alternate public directory containing compressed language files. Must allow CORS. |
| `workerUrl` | `misaki.worker.js` below `assetBaseUrl` | Explicit worker module URL for custom hosting layouts. |
| `onDataProgress` | `undefined` | Callback receiving aggregate byte and file progress while language data is downloaded. |
| `preload` | `["en-us"]` | Languages loaded before `createMisaki` resolves. Pass `[]` to initialize only the runtime. |

### Client methods

| Method | Description |
|---|---|
| `ready()` | Wait for initialization and return the same client. `createMisaki` already awaits this step. |
| `loadLanguage(language?)` | Download and register one language's data. Repeated calls reuse the existing download/cache. |
| `phonemize(text, language?)` | Convert one string to phonemes. |
| `phonemizeBatch(texts, language?)` | Convert an array of strings using one language engine. |
| `dispose()` | Terminate the worker and release client resources. |

The package exports the `languages` constant and the `MisakiLanguage`, `MisakiOptions`, and `MisakiClient` TypeScript types.

## Data loading lifecycle

`createMisaki()` preloads `en-us` by default. Its promise resolves only after both the WASM runtime and English data are ready, so the first `phonemize` call performs no network download:

```js
const misaki = await createMisaki();
const phonemes = await misaki.phonemize("Hello world.", "en-us");
```

Preload the languages required by the initial screen during initialization:

```js
const misaki = await createMisaki({
  preload: ["en-us", "ja"],
  onDataProgress: updateProgressBar,
});
```

To initialize only the runtime, pass an empty list. The application can then download language data during an idle period:

```js
const misaki = await createMisaki({ preload: [] });

requestIdleCallback(async () => {
  await misaki.loadLanguage("ja");
  console.log("Japanese data is ready");
});
```

For browsers without `requestIdleCallback`, call `loadLanguage` from an application-specific idle/background task. Calls are idempotent, so requesting an already loaded language does not download it again.

`phonemize` and `phonemizeBatch` never trigger a download. Calling either method for an unloaded language rejects with an error instructing the caller to use `loadLanguage` first.

## Download progress

Provide `onDataProgress` to update a progress bar or status label. The same callback works in Web Worker and direct modes:

```js
const misaki = await createMisaki({
  onDataProgress(progress) {
    if (progress.percent !== null) {
      console.log(`${Math.round(progress.percent * 100)}%`);
    }

    console.log(
      progress.language,
      `${progress.filesLoaded}/${progress.filesTotal} files`,
      `${progress.loadedBytes}/${progress.totalBytes ?? "?"} bytes`,
    );
  },
});
```

The built-in manifest contains the exact size of every versioned asset, so the default source reports determinate byte progress even when the data server omits `Content-Length`. `percent` and `totalBytes` may be `null` only for a future/custom manifest without known sizes. `done` becomes `true` after every required file has been registered with the WASM runtime. Cached language data reports completion immediately without downloading it again.

## Deploy

The browser must be able to fetch runtime assets after the JavaScript bundle has loaded. The most predictable deployment is to copy `dist/` unchanged into the site's public directory:

```js
import { createMisaki } from "misakisharp-wasm";

const misaki = await createMisaki({
  assetBaseUrl: "/vendor/misakisharp/",
});
```

Keep `misaki.worker.js`, `misaki.data.js`, and `_framework/` together under that URL. By default, language data comes from the `data-v2.2.0` browser-mirror branch. To use another mirror or CDN, point the client to it:

```js
const misaki = await createMisaki({
  assetBaseUrl: "/vendor/misakisharp/",
  dataBaseUrl: "https://cdn.example.com/misaki-data/2.2.0/",
});
```

The data origin must allow CORS requests from the application. Preserve the original filenames because the runtime requests them through a fixed manifest.

Serve the application over HTTP or HTTPS. Opening a page through a `file:` URL does not work because the browser must fetch the worker, WASM runtime, and language files.

For production:

- Serve `.wasm` as `application/wasm` and JavaScript files as a JavaScript MIME type.
- Enable Brotli or Gzip compression at the HTTP server or CDN.
- Give versioned `_framework/` and mirrored data assets long-lived immutable cache headers.
- Reuse a client instead of creating one for every request.
- Prefer `phonemizeBatch` for multiple strings in one language.

## Language data

Language models and dictionaries are published as GitHub Release assets, not files inside `MisakiSharp.wasm` or the npm package. A byte-identical copy is kept in the versioned `data-v2.2.0` branch because GitHub Release downloads currently do not include CORS headers required by browser `fetch`. A language's files are downloaded from that mirror only through initialization preload or an explicit `loadLanguage` call, then reused by that client.

This separation keeps the application WASM around 165 KiB and removes about 66 MiB from the installed package. Applications transfer only the data files required by the languages they use.

The default browser URL is:

```text
https://raw.githubusercontent.com/thuongvovan/MisakiSharpJS/data-v2.2.0/
```

Release filenames are part of the runtime contract and must not be changed. The release tag, mirror branch, and default URL in `dist/misaki.js` must be updated together when publishing a new data version.

## Package contents

| Path | Purpose |
|---|---|
| `dist/misaki.js` | Public ES module API |
| `dist/misaki.d.ts` | TypeScript declarations |
| `dist/misaki.worker.js` | Worker host |
| `dist/misaki.data.js` | Lazy data loader and manifest |
| `dist/_framework/` | .NET WebAssembly runtime and compiled application |
| `example/` | Minimal application using this package through `file:..` |

## Run the example

```sh
cd example
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173). The example has no web framework dependency. It preloads `en-us` during initialization, starts loading another language when the selection changes, and calls `phonemize` only after that data is ready.

## Package or publish this repository

### Publish language data

Pushing a version tag runs `.github/workflows/release-data.yml`, creates the matching release, and uploads the compressed data from the pinned C# source commit:

```sh
git tag v2.2.0
git push origin v2.2.0
```

For a manual release, upload the compressed files from the C# source repository without renaming them:

```sh
gh release create v2.2.0 /absolute/path/to/MisakiSharp/data/*.gz \
  --repo thuongvovan/MisakiSharpJS \
  --title "MisakiSharp WASM 2.2.0" \
  --notes "Browser runtime and lazy-loaded language data for MisakiSharp WASM 2.2.0."
```

To update assets on an existing release:

```sh
gh release upload v2.2.0 /absolute/path/to/MisakiSharp/data/*.gz \
  --repo thuongvovan/MisakiSharpJS \
  --clobber
```

Keep the data as individual `.gz` assets rather than one archive. This allows the loader to download only the subset required by the requested language.

### Package the JavaScript runtime

Inspect the files that npm will include:

```sh
npm pack --dry-run
```

Create an installable tarball:

```sh
npm pack
```

Publish when the package name and version are ready:

```sh
npm publish
```

The npm artifact contains the runtime in `dist/` plus npm's required package metadata, root README, and license. Language data and the example are not installed into consumer projects.

## Rebuild from C# source

This repository intentionally contains generated artifacts, not the C# build system. To produce a new runtime:

1. Open the MisakiSharp source repository.
2. Install the .NET 8 `wasm-tools` workload.
3. Run `npm run build` inside its `Web/` directory.
4. Replace this repository's `dist/` with the generated `Web/dist/`.
5. Create the matching GitHub Release and upload the source repository's individual `data/*.gz` files as release assets.
6. Synchronize the version and release URL, verify the example, and run `npm pack --dry-run`.

Keep the C# repository as the source of truth for implementation changes. This prebuilt repository is sufficient for distribution and application development, but it cannot regenerate the WASM runtime by itself.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE) for upstream attribution.
