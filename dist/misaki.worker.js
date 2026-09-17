import { ensureLanguageData } from "./misaki.data.js";

let apiPromise;
let runtimeBaseUrl;
let dataBaseUrl;
const loadedLanguages = new Set();

function getApi(assetBaseUrl) {
  if (assetBaseUrl) {
    const resolved = new URL(assetBaseUrl, self.location.href).href;
    if (runtimeBaseUrl && runtimeBaseUrl !== resolved) {
      throw new Error("Misaki worker was initialized with a different asset location");
    }
    runtimeBaseUrl = resolved;
  }
  if (!runtimeBaseUrl) {
    throw new Error("Misaki worker must be initialized before use");
  }
  if (!apiPromise) {
    apiPromise = (async () => {
      const runtimeUrl = new URL("_framework/dotnet.js", runtimeBaseUrl);
      const { dotnet } = await import(runtimeUrl.href);
      const runtime = await dotnet.withDiagnosticTracing(false).create();
      const config = runtime.getConfig();
      const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
      const api = exports.MisakiSharp.Web.WasmApi;
      unwrapManaged(api.Ping());
      return api;
    })();
  }
  return apiPromise;
}

function unwrapManaged(result) {
  if (result[0] === "\0") return result.slice(1);
  if (result[0] === "\x01") throw new Error(result.slice(1));
  throw new Error("Invalid response from MisakiSharp WASM");
}

self.addEventListener("message", async ({ data }) => {
  try {
    if (data.method === "ready") dataBaseUrl = new URL(data.args[1], self.location.href);
    const api = await getApi(data.method === "ready" ? data.args[0] : undefined);
    let value;
    switch (data.method) {
      case "ready":
        value = undefined;
        break;
      case "loadLanguage":
        await ensureLanguageData(api, data.args[0], dataBaseUrl, reportProgress);
        loadedLanguages.add(data.args[0]);
        value = undefined;
        break;
      case "phonemize":
        requireLoaded(data.args[0]);
        value = unwrapManaged(api.Phonemize(data.args[0], data.args[1]));
        break;
      case "phonemizeBatch":
        requireLoaded(data.args[0]);
        value = JSON.parse(unwrapManaged(api.PhonemizeBatch(data.args[0], JSON.stringify(data.args[1]))));
        break;
      default:
        throw new Error(`Unknown Misaki worker method: ${data.method}`);
    }
    self.postMessage({ id: data.id, ok: true, value });
  } catch (error) {
    console.error("Misaki worker call failed", error);
    self.postMessage({
      id: data.id,
      ok: false,
      error: describeError(error),
    });
  }
});

function reportProgress(progress) {
  self.postMessage({ type: "data-progress", progress });
}

function requireLoaded(language) {
  if (!loadedLanguages.has(language)) {
    throw new Error(`Language '${language}' is not loaded. Call loadLanguage('${language}') before phonemize().`);
  }
}

function describeError(error) {
  if (error instanceof Error) return error.stack || error.message;
  if (error && typeof error === "object") {
    const details = [error.message, error.stack].filter(Boolean).join("\n");
    if (details) return details;
    try {
      const json = JSON.stringify(error, Object.getOwnPropertyNames(error));
      if (json && json !== "{}") return json;
    } catch {
    }
  }
  return String(error);
}
