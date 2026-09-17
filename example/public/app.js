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

let clientPromise;
let client;

language.addEventListener("change", () => {
  text.value = samples[language.value];
  text.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = text.value.trim();
  if (!input) return;

  setBusy(true);
  resetDataProgress(language.value);
  const started = performance.now();
  try {
    const misaki = await getClient();
    setStatus("loading", `Đang tải data ${language.value}…`);
    const phonemes = await misaki.phonemize(input, language.value);
    const elapsed = performance.now() - started;
    result.textContent = phonemes || "(Không có phoneme)";
    timing.textContent = `${elapsed.toFixed(1)} ms`;
    setStatus("ready", "Runtime sẵn sàng");
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
    timing.textContent = "Có lỗi";
    setStatus("error", "Không thể xử lý");
  } finally {
    setBusy(false);
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

window.addEventListener("beforeunload", () => client?.dispose());

async function getClient() {
  if (!clientPromise) {
    setStatus("loading", "Đang tải WASM…");
    clientPromise = createMisaki({
      assetBaseUrl: "/vendor/misakisharp/",
      onDataProgress: updateDataProgress,
    })
      .then((value) => client = value)
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}

function setBusy(busy) {
  submit.disabled = busy;
  submit.classList.toggle("busy", busy);
  submit.querySelector("span:first-child").textContent = busy ? "Đang xử lý" : "Phonemize";
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
  setStatus("loading", progress.done ? "Đang xử lý phoneme…" : `Đang tải data ${progress.language}…`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
