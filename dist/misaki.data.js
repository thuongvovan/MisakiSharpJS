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

const registeredByApi = new WeakMap();

export async function ensureLanguageData(api, language, dataBaseUrl) {
  const files = LANGUAGE_DATA[language];
  if (!files) throw new RangeError(`Unsupported language: ${language}`);

  let registered = registeredByApi.get(api);
  if (!registered) {
    registered = new Map();
    registeredByApi.set(api, registered);
  }

  await Promise.all(files.map((name) => {
    let pending = registered.get(name);
    if (!pending) {
      pending = loadDataFile(api, name, dataBaseUrl).catch((error) => {
        registered.delete(name);
        throw error;
      });
      registered.set(name, pending);
    }
    return pending;
  }));
}

async function loadDataFile(api, name, dataBaseUrl) {
  const url = new URL(name, dataBaseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load Misaki data '${name}' (${response.status} ${response.statusText}) from ${url}`);
  }

  const result = api.RegisterData(name, new Uint8Array(await response.arrayBuffer()));
  if (result[0] === "\0") return;
  if (result[0] === "\x01") throw new Error(result.slice(1));
  throw new Error("Invalid response while registering Misaki data");
}
