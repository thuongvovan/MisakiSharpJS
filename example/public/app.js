import { createMisaki, languages } from "misakisharp-wasm";

const samples = {
  "en-us": "Hello world. WebAssembly keeps the interface responsive.",
  "en-gb": "Good morning. Would you like a cup of tea?",
  ja: "日本語は面白い！今日は良い天気です。",
  zh: "你好，世界！欢迎使用 MisakiSharp。",
  "zh-legacy": "你好，世界！",
  es: "Hola, mundo. Este ejemplo funciona en el navegador.",
  "fr-fr": "Bonjour le monde. Tout fonctionne dans le navigateur.",
  hi: "नमस्ते दुनिया। यह ब्राउज़र में चलता है।",
  it: "Ciao mondo. Questo esempio funziona nel browser.",
  "pt-br": "Olá, mundo. Este exemplo funciona no navegador.",
};

const form = document.querySelector("#phonemize-form");
const language = document.querySelector("#language");
const text = document.querySelector("#text");
const result = document.querySelector("#result");
const timing = document.querySelector("#timing");
const submit = document.querySelector("#submit");
const runtimeStatus = document.querySelector("#runtime-status");
const dataProgress = document.querySelector("#data-progress");
const dataProgressLabel = document.querySelector("#data-progress-label");
const dataProgressValue = document.querySelector("#data-progress-value");
const dataProgressTrack = document.querySelector("#data-progress-track");
const dataProgressBar = document.querySelector("#data-progress-bar");

for (const code of languages) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = code;
  language.append(option);
}

let client;
const languageLoads = new Map();
const clientPromise = initializeClient();
clientPromise.catch(() => {});

language.addEventListener("change", () => {
  text.value = samples[language.value];
  text.focus();
  loadLanguageData(language.value).catch(showError);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = text.value.trim();
  if (!input) return;

  setBusy(true);
  const started = performance.now();
  try {
    const misaki = await getClient();
    await loadLanguageData(language.value);
    setStatus("loading", "Đang xử lý phoneme…");
    const phonemes = await misaki.phonemize(input, language.value);
    const elapsed = performance.now() - started;
    result.textContent = phonemes || "(Không có phoneme)";
    timing.textContent = `${elapsed.toFixed(1)} ms`;
    setStatus("ready", "Runtime sẵn sàng");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

window.addEventListener("beforeunload", () => client?.dispose());

async function getClient() {
  return clientPromise;
}

async function initializeClient() {
  setBusy(true, "Đang khởi tạo");
  setStatus("loading", "Đang tải WASM…");
  resetDataProgress("en-us");
  try {
    client = await createMisaki({
      assetBaseUrl: "/vendor/misakisharp/",
      preload: ["en-us"],
      onDataProgress: updateDataProgress,
    });
    languageLoads.set("en-us", Promise.resolve(client));
    setStatus("ready", "Runtime và data en-us sẵn sàng");
    return client;
  } catch (error) {
    showError(error);
    throw error;
  } finally {
    setBusy(false);
  }
}

function loadLanguageData(code) {
  let pending = languageLoads.get(code);
  if (!pending) {
    pending = getClient().then(async (misaki) => {
      resetDataProgress(code);
      await misaki.loadLanguage(code);
      if (language.value === code) setStatus("ready", `Data ${code} sẵn sàng`);
      return misaki;
    }).catch((error) => {
      languageLoads.delete(code);
      throw error;
    });
    languageLoads.set(code, pending);
  }
  return pending;
}

function setBusy(busy, label = "Đang xử lý") {
  submit.disabled = busy;
  submit.classList.toggle("busy", busy);
  submit.querySelector("span:first-child").textContent = busy ? label : "Phonemize";
}

function setStatus(state, label) {
  runtimeStatus.dataset.state = state;
  runtimeStatus.querySelector("span:last-child").textContent = label;
}

function resetDataProgress(code) {
  dataProgress.hidden = false;
  dataProgressLabel.textContent = `Đang chuẩn bị data ${code}…`;
  dataProgressValue.textContent = "0%";
  dataProgressBar.style.width = "0%";
  dataProgressTrack.classList.remove("indeterminate");
  dataProgressTrack.setAttribute("aria-valuenow", "0");
}

function updateDataProgress(progress) {
  dataProgress.hidden = false;
  const percent = progress.percent === null ? null : Math.round(progress.percent * 100);
  const fileStatus = `${progress.filesLoaded}/${progress.filesTotal} file`;
  dataProgressLabel.textContent = progress.done
    ? `Data ${progress.language} đã sẵn sàng · ${fileStatus}`
    : `Đang tải data ${progress.language} · ${fileStatus}`;
  dataProgressValue.textContent = progress.totalBytes === null
    ? formatBytes(progress.loadedBytes)
    : `${formatBytes(progress.loadedBytes)} / ${formatBytes(progress.totalBytes)} · ${percent}%`;
  dataProgressTrack.classList.toggle("indeterminate", percent === null);
  if (percent === null) {
    dataProgressTrack.removeAttribute("aria-valuenow");
    dataProgressBar.style.width = "32%";
  } else {
    dataProgressTrack.setAttribute("aria-valuenow", String(percent));
    dataProgressBar.style.width = `${percent}%`;
  }
  setStatus(progress.done ? "ready" : "loading", progress.done ? `Data ${progress.language} sẵn sàng` : `Đang tải data ${progress.language}…`);
}

function showError(error) {
  result.textContent = error instanceof Error ? error.message : String(error);
  timing.textContent = "Có lỗi";
  setStatus("error", "Không thể xử lý");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
