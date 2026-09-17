import { ensureLanguageData } from "./misaki.data.js";

const DEFAULT_DATA_BASE_URL = "https://raw.githubusercontent.com/thuongvovan/MisakiSharpJS/data-v2.2.0/";

const SUPPORTED_LANGUAGES = new Set([
  "en-us",
  "en-gb",
  "ja",
  "zh",
  "zh-legacy",
  "es",
  "fr-fr",
  "hi",
  "it",
  "pt-br",
]);

export const languages = Object.freeze([...SUPPORTED_LANGUAGES]);

let directApiPromise;
let directAssetBaseUrl;

function normalizeLanguage(language) {
  const normalized = String(language).trim().toLowerCase().replaceAll("_", "-");
  if (!SUPPORTED_LANGUAGES.has(normalized)) {
    throw new RangeError(`Unsupported language: ${language}`);
  }
  return normalized;
}

function unwrapManaged(result) {
  if (result[0] === "\0") return result.slice(1);
  if (result[0] === "\x01") throw new Error(result.slice(1));
  throw new Error("Invalid response from MisakiSharp WASM");
}

function resolveAssetBaseUrl(value) {
  const url = value == null
    ? new URL("./", import.meta.url)
    : new URL(String(value), import.meta.url);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function loadDirectApi(assetBaseUrl) {
  if (directAssetBaseUrl && directAssetBaseUrl !== assetBaseUrl.href) {
    throw new Error("Direct mode can only load one MisakiSharp asset location per page");
  }
  directAssetBaseUrl = assetBaseUrl.href;
  if (!directApiPromise) {
    directApiPromise = (async () => {
      const runtimeUrl = new URL("_framework/dotnet.js", assetBaseUrl);
      const { dotnet } = await import(runtimeUrl.href);
      const runtime = await dotnet.withDiagnosticTracing(false).create();
      const config = runtime.getConfig();
      const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
      const api = exports.MisakiSharp.Web.WasmApi;
      unwrapManaged(api.Ping());
      return api;
    })();
  }
  return directApiPromise;
}

class DirectClient {
  #assetBaseUrl;
  #dataBaseUrl;
  #onDataProgress;

  constructor(assetBaseUrl, dataBaseUrl, onDataProgress) {
    this.#assetBaseUrl = assetBaseUrl;
    this.#dataBaseUrl = dataBaseUrl;
    this.#onDataProgress = onDataProgress;
  }

  async ready() {
    await loadDirectApi(this.#assetBaseUrl);
    return this;
  }

  async phonemize(text, language = "en-us") {
    const api = await loadDirectApi(this.#assetBaseUrl);
    const normalized = normalizeLanguage(language);
    await ensureLanguageData(api, normalized, this.#dataBaseUrl, this.#onDataProgress);
    return unwrapManaged(api.Phonemize(normalized, String(text)));
  }

  async phonemizeBatch(texts, language = "en-us") {
    if (!Array.isArray(texts)) {
      throw new TypeError("texts must be an array of strings");
    }
    const api = await loadDirectApi(this.#assetBaseUrl);
    const normalized = normalizeLanguage(language);
    await ensureLanguageData(api, normalized, this.#dataBaseUrl, this.#onDataProgress);
    const result = unwrapManaged(api.PhonemizeBatch(normalized, JSON.stringify(texts.map(String))));
    return JSON.parse(result);
  }

  dispose() {
  }
}

class WorkerClient {
  #assetBaseUrl;
  #dataBaseUrl;
  #disposed = false;
  #nextId = 1;
  #pending = new Map();
  #worker;

  constructor(workerUrl, assetBaseUrl, dataBaseUrl, onDataProgress) {
    this.#worker = new Worker(workerUrl, { type: "module", name: "misaki-wasm" });
    this.#worker.addEventListener("message", ({ data }) => {
      if (data.type === "data-progress") {
        onDataProgress?.(data.progress);
        return;
      }
      const pending = this.#pending.get(data.id);
      if (!pending) return;
      this.#pending.delete(data.id);
      if (data.ok) pending.resolve(data.value);
      else pending.reject(new Error(data.error));
    });
    this.#worker.addEventListener("error", (event) => {
      this.#disposed = true;
      const error = event.error ?? new Error(event.message || "Misaki worker failed");
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
    this.#assetBaseUrl = assetBaseUrl;
    this.#dataBaseUrl = dataBaseUrl;
  }

  #call(method, ...args) {
    if (this.#disposed) {
      return Promise.reject(new Error("Misaki client was disposed"));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker.postMessage({ id, method, args });
    });
  }

  async ready() {
    await this.#call("ready", this.#assetBaseUrl.href, this.#dataBaseUrl.href);
    return this;
  }

  phonemize(text, language = "en-us") {
    return this.#call("phonemize", normalizeLanguage(language), String(text));
  }

  phonemizeBatch(texts, language = "en-us") {
    if (!Array.isArray(texts)) {
      return Promise.reject(new TypeError("texts must be an array of strings"));
    }
    return this.#call("phonemizeBatch", normalizeLanguage(language), texts.map(String));
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker.terminate();
    const error = new Error("Misaki client was disposed");
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}

/**
 * Loads MisakiSharp and returns a promise-based browser client.
 * A dedicated worker is used by default so CPU-heavy G2P work never blocks rendering.
 */
export async function createMisaki(options = {}) {
  const useWorker = options.worker ?? true;
  if (options.onDataProgress != null && typeof options.onDataProgress !== "function") {
    throw new TypeError("onDataProgress must be a function");
  }
  const canUseWorker = typeof Worker !== "undefined";
  const assetBaseUrl = resolveAssetBaseUrl(options.assetBaseUrl);
  const dataBaseUrl = options.dataBaseUrl == null
    ? new URL(DEFAULT_DATA_BASE_URL)
    : resolveAssetBaseUrl(options.dataBaseUrl);
  const workerUrl = options.workerUrl == null
    ? new URL("misaki.worker.js", assetBaseUrl)
    : new URL(String(options.workerUrl), import.meta.url);
  const client = useWorker && canUseWorker
    ? new WorkerClient(workerUrl, assetBaseUrl, dataBaseUrl, options.onDataProgress)
    : new DirectClient(assetBaseUrl, dataBaseUrl, options.onDataProgress);
  return client.ready();
}
