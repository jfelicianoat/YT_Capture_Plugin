import { validateCapture } from "../src/contracts/capture-validator.js";
import { prepareCaptureForDownload } from "../src/capture-pipeline.js";
import { downloadCaptureMarkdown } from "../src/download/chrome-downloader.js";
import { extractYoutubeVideo, getYoutubeVideoId } from "../src/extraction/extractor.js";
import { buildCaptureMarkdown } from "../src/markdown/markdown-builder.js";

const captureButton = document.querySelector("#capture-button");
const statusMessage = document.querySelector("#status-message");
const fields = {
  title: document.querySelector("#video-title"),
  channel: document.querySelector("#video-channel"),
  duration: document.querySelector("#video-duration"),
  published: document.querySelector("#video-published"),
  transcript: document.querySelector("#video-transcript")
};

let currentVideoId = null;
let currentCandidate = null;
let refreshGeneration = 0;
let monitorId = null;
let isBusy = false;

function setStatus(message, state = "idle") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":")
    : [minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function resetFields() {
  fields.title.textContent = "Pendiente de detección";
  fields.channel.textContent = "—";
  fields.duration.textContent = "—";
  fields.published.textContent = "—";
  fields.transcript.textContent = "—";
}

function setCaptureButton({ disabled, label = "Capturar vídeo" }) {
  captureButton.disabled = disabled;
  captureButton.textContent = label;
}

function showCapture(candidate) {
  fields.title.textContent = candidate.title;
  fields.channel.textContent = candidate.channel;
  fields.duration.textContent = formatDuration(candidate.duration_seconds);
  fields.published.textContent = candidate.published_date ?? "No disponible";
  fields.transcript.textContent = candidate.has_transcript
    ? `${candidate.transcript_source === "manual" ? "Manual" : "Automática"} (${candidate.transcript_language})`
    : "No disponible";
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function refreshFromActiveTab() {
  const generation = ++refreshGeneration;
  const tab = await activeTab();
  const videoId = getYoutubeVideoId(tab?.url);

  if (!tab?.id || !videoId) {
    currentVideoId = null;
    currentCandidate = null;
    resetFields();
    setCaptureButton({ disabled: true });
    setStatus("Abre un vídeo de YouTube para detectar sus datos.");
    return;
  }

  currentVideoId = videoId;
  currentCandidate = null;
  setCaptureButton({ disabled: true });
  setStatus("Detectando metadatos y transcripción…");

  try {
    const candidate = await extractYoutubeVideo({ tabId: tab.id, tabUrl: tab.url });
    if (generation !== refreshGeneration) return;

    const contract = validateCapture(candidate);
    if (!contract.valid) {
      const first = contract.errors[0];
      throw new Error(`Contrato inválido: ${first.field} — ${first.message}`);
    }

    showCapture(candidate);
    currentCandidate = candidate;
    setCaptureButton({ disabled: false });
    setStatus(candidate.has_transcript
      ? "Datos listos para generar el Markdown."
      : "Vídeo sin transcripción. Se generará el Markdown con la sección vacía.");
  } catch (error) {
    if (generation !== refreshGeneration) return;
    currentCandidate = null;
    resetFields();
    setCaptureButton({ disabled: true });
    setStatus(`No se pudo completar la detección: ${error.message}`, "error");
  }
}

async function captureCurrentVideo() {
  if (isBusy || !currentCandidate) return;
  const candidate = currentCandidate;
  isBusy = true;
  setCaptureButton({ disabled: true, label: "Preparando…" });
  setStatus("Validando y generando el archivo…");

  try {
    const result = await prepareCaptureForDownload(candidate, {
      serialize: buildCaptureMarkdown,
      download: downloadCaptureMarkdown
    });
    setStatus(`Descarga iniciada: ${result.filename}`, "success");
  } catch (error) {
    console.error("Error al capturar el vídeo", error);
    setStatus(error?.message ?? "No se pudo descargar el archivo.", "error");
  } finally {
    isBusy = false;
    const candidateStillCurrent = currentCandidate?.capture_id === candidate.capture_id;
    setCaptureButton({ disabled: !candidateStillCurrent });
  }
}

async function monitorSpaNavigation() {
  try {
    const tab = await activeTab();
    const detectedVideoId = getYoutubeVideoId(tab?.url);
    if (detectedVideoId !== currentVideoId) await refreshFromActiveTab();
  } catch (error) {
    setStatus(`No se pudo comprobar la navegación: ${error.message}`, "error");
  }
}

async function initializePopup() {
  try {
    const health = await chrome.runtime.sendMessage({ type: "HEALTH_CHECK" });
    if (!health?.ok) throw new Error("El service worker no respondió correctamente");
    setStatus(`Extensión v${health.version} lista. Detectando vídeo…`);
    await refreshFromActiveTab();
    monitorId = window.setInterval(monitorSpaNavigation, 1000);
  } catch (error) {
    setCaptureButton({ disabled: true });
    setStatus(`No se pudo iniciar la extensión: ${error.message}`, "error");
  }
}

captureButton.addEventListener("click", captureCurrentVideo);
initializePopup();

window.addEventListener("unload", () => {
  if (monitorId !== null) window.clearInterval(monitorId);
});
