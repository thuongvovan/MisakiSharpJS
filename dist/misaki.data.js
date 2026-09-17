const ENGLISH_COMMON = ["en_tokenizer.tsv.gz", "en_tagger.bin.gz"];

const LANGUAGE_DATA = Object.freeze({
  "en-us": ["en_lexicon_us.tsv.gz", "enus_espeak.tsv.gz", ...ENGLISH_COMMON],
  "en-gb": ["en_lexicon_gb.tsv.gz", "engb_espeak.tsv.gz", ...ENGLISH_COMMON],
  ja: ["ja_words.txt.gz", "ja_lexicon.tsv.gz", "ja_char_unk.tsv.gz", "ja_matrix_compact.bin.gz"],
  zh: ["zh_g2p_v2.tsv.gz", "zh_posseg_hmm.tsv.gz", "zh_finalseg_hmm.tsv.gz", "en_lexicon_us.tsv.gz", "enus_espeak.tsv.gz", ...ENGLISH_COMMON],
  "zh-legacy": ["zh_g2p.tsv.gz", "en_lexicon_us.tsv.gz", "enus_espeak.tsv.gz", ...ENGLISH_COMMON],
  es: ["es_espeak.tsv.gz"],
  "fr-fr": ["fr_espeak.tsv.gz"],
  hi: ["hi_espeak.tsv.gz"],
  it: ["it_espeak.tsv.gz"],
  "pt-br": ["pt_espeak.tsv.gz"],
});

const DATA_FILE_SIZES = Object.freeze({
  "en_lexicon_gb.tsv.gz": 2896633,
  "en_lexicon_us.tsv.gz": 2714349,
  "en_tagger.bin.gz": 2816828,
  "en_tokenizer.tsv.gz": 18222,
  "engb_espeak.tsv.gz": 5918961,
  "enus_espeak.tsv.gz": 6047471,
  "es_espeak.tsv.gz": 4133908,
  "fr_espeak.tsv.gz": 4460144,
  "hi_espeak.tsv.gz": 2860523,
  "hi_espeak_lexicon.tsv.gz": 1453836,
  "it_espeak.tsv.gz": 4306922,
  "ja_char_unk.tsv.gz": 885,
  "ja_lexicon.tsv.gz": 8286957,
  "ja_matrix_compact.bin.gz": 10018877,
  "ja_words.txt.gz": 484476,
  "pt_espeak.tsv.gz": 4267840,
  "zh_finalseg_hmm.tsv.gz": 265883,
  "zh_g2p.tsv.gz": 2304581,
  "zh_g2p_v2.tsv.gz": 5136595,
  "zh_posseg_hmm.tsv.gz": 798148,
});

const registeredByApi = new WeakMap();

export async function ensureLanguageData(api, language, dataBaseUrl, onProgress) {
  const files = LANGUAGE_DATA[language];
  if (!files) throw new RangeError(`Unsupported language: ${language}`);

  let registered = registeredByApi.get(api);
  if (!registered) {
    registered = new Map();
    registeredByApi.set(api, registered);
  }

  const entries = files.map((name) => {
    let entry = registered.get(name);
    if (!entry) {
      entry = { name, loaded: 0, total: DATA_FILE_SIZES[name] ?? null, done: false, listeners: new Set(), promise: null };
      registered.set(name, entry);
      entry.promise = loadDataFile(api, name, dataBaseUrl, entry.total, (loaded, total) => {
        entry.loaded = loaded;
        entry.total = total;
        notify(entry);
      }).then(() => {
        entry.done = true;
        entry.total ??= entry.loaded;
        notify(entry);
      }).catch((error) => {
        registered.delete(name);
        notify(entry);
        throw error;
      });
    }
    return entry;
  });

  const report = (file = null) => {
    if (typeof onProgress !== "function") return;
    const filesLoaded = entries.filter((entry) => entry.done).length;
    const loadedBytes = entries.reduce((sum, entry) => sum + entry.loaded, 0);
    const totalsKnown = entries.every((entry) => entry.total !== null);
    const totalBytes = totalsKnown
      ? entries.reduce((sum, entry) => sum + entry.total, 0)
      : null;
    const done = filesLoaded === entries.length;
    onProgress({
      language,
      file,
      loadedBytes,
      totalBytes,
      filesLoaded,
      filesTotal: entries.length,
      percent: totalBytes === null ? null : totalBytes === 0 ? 1 : Math.min(1, loadedBytes / totalBytes),
      done,
    });
  };

  for (const entry of entries) entry.listeners.add(report);
  report();
  try {
    await Promise.all(entries.map((entry) => entry.promise));
    report();
  } finally {
    for (const entry of entries) entry.listeners.delete(report);
  }
}

function notify(entry) {
  for (const listener of entry.listeners) listener(entry.name);
}

async function loadDataFile(api, name, dataBaseUrl, expectedSize, onProgress) {
  const url = new URL(name, dataBaseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load Misaki data '${name}' (${response.status} ${response.statusText}) from ${url}`);
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  const total = Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : expectedSize;
  const bytes = await readResponse(response, total, onProgress);
  const result = api.RegisterData(name, bytes);
  if (result[0] === "\0") return;
  if (result[0] === "\x01") throw new Error(result.slice(1));
  throw new Error("Invalid response while registering Misaki data");
}

async function readResponse(response, total, onProgress) {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress(bytes.byteLength, total ?? bytes.byteLength);
    return bytes;
  }

  const reader = response.body.getReader();
  let target = total === null ? null : new Uint8Array(total);
  let chunks = target === null ? [] : null;
  let loaded = 0;
  onProgress(loaded, total);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (target && loaded + value.byteLength <= target.byteLength) {
      target.set(value, loaded);
    } else {
      if (target) {
        chunks = [target.subarray(0, loaded)];
        target = null;
      }
      chunks.push(value);
    }
    loaded += value.byteLength;
    onProgress(loaded, total);
  }

  if (target) return loaded === target.byteLength ? target : target.slice(0, loaded);
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
