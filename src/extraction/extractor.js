import { collectYoutubePageData } from "./page-context.js";
import { buildCaptureCandidate, getYoutubeVideoId, selectMetadata } from "./metadata.js";
import { captionTrackType, parseJson3Transcript, selectCaptionTrack, withJson3Format } from "./transcript.js";
import { openTranscriptPanelWithChrome, parsePanelSegments } from "./transcript-panel.js";

export const TRANSCRIPT_FETCH_TIMEOUT_MS = 15_000;

export class ExtractionError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.details = details;
  }
}

async function executeInPageWithChrome(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: collectYoutubePageData
  });
  return results[0]?.result ?? null;
}

// Descarga los subtítulos desde el propio contexto de la pestaña de YouTube.
// Es imprescindible: desde el origen `chrome-extension://` del popup, el
// endpoint `timedtext` responde HTTP 200 con cuerpo vacío porque falta la
// sesión y el token anti-bot que sí tiene la página.
async function fetchTranscriptInPageWithChrome(tabId, url) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [url],
    func: async (transcriptUrl) => {
      try {
        const response = await fetch(transcriptUrl, { credentials: "include" });
        const body = await response.text();
        return { ok: response.ok, status: response.status, body };
      } catch (error) {
        return { ok: false, status: 0, body: "", error: String(error?.message ?? error) };
      }
    }
  });
  return results[0]?.result ?? null;
}

export async function fetchJsonWithBrowser(
  url,
  {
    fetchFunction = fetch,
    timeoutMs = TRANSCRIPT_FETCH_TIMEOUT_MS,
    AbortControllerClass = AbortController
  } = {}
) {
  const controller = new AbortControllerClass();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFunction(url, { credentials: "include", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function baseLanguage(value) {
  return typeof value === "string" && value.length >= 2 ? value.toLowerCase().split("-")[0] : null;
}

export async function extractYoutubeVideo(
  { tabId, tabUrl },
  {
    executeInPage = executeInPageWithChrome,
    openTranscriptPanel = openTranscriptPanelWithChrome,
    fetchTranscriptInPage = fetchTranscriptInPageWithChrome,
    fetchJson = fetchJsonWithBrowser,
    now = () => new Date(),
    pluginVersion = () => chrome.runtime.getManifest().version
  } = {}
) {
  const videoId = getYoutubeVideoId(tabUrl);
  if (!videoId) throw new ExtractionError("NOT_YOUTUBE_VIDEO", "La pestaña activa no contiene un vídeo de YouTube válido");

  const pageData = await executeInPage(tabId);
  if (!pageData) throw new ExtractionError("PAGE_DATA_UNAVAILABLE", "No se pudieron leer los datos de la página");

  const metadata = selectMetadata(pageData, tabUrl);
  if (!metadata.title) throw new ExtractionError("TITLE_UNAVAILABLE", "YouTube todavía no ha publicado el título del vídeo");

  let transcriptContent = "";
  let transcriptLanguage = null;
  let transcriptSource = null;
  let transcriptNote = null;
  const tracks = pageData.captionTracks ?? [];
  const selectedTrack = selectCaptionTrack(tracks, pageData.uiLanguage);
  const uiBaseLanguage = baseLanguage(pageData.uiLanguage);

  // Enfoque A (principal): leer el panel "Mostrar transcripción" de YouTube.
  // Lo alimenta el propio reproductor, así que evita el bloqueo anti-bot (`pot`)
  // que hoy devuelve cuerpos vacíos en el endpoint `timedtext`.
  try {
    const panel = await openTranscriptPanel(tabId);
    const panelContent = parsePanelSegments(panel?.segments);
    if (panelContent) {
      transcriptContent = panelContent;
      transcriptLanguage = selectedTrack?.languageCode ?? uiBaseLanguage ?? "und";
      transcriptSource = selectedTrack ? captionTrackType(selectedTrack) : "automatic";
    } else if (panel?.reason === "no-transcript-button") {
      transcriptNote = "YouTube no ofrece transcripción para este vídeo.";
    } else if (panel?.error) {
      transcriptNote = `No se pudo abrir el panel de transcripción (${panel.error}).`;
    } else if (panel?.reason === "panel-empty") {
      transcriptNote = "El panel de transcripción de YouTube no cargó a tiempo; recarga la página o vuelve a pulsar el botón.";
    }
  } catch (error) {
    transcriptNote = `No se pudo abrir el panel de transcripción (${error?.message ?? error}).`;
  }

  // Fallback: endpoint `timedtext` en formato json3. Sigue funcionando en
  // algunas sesiones (con sesión iniciada, ciertos vídeos) pese al token `pot`.
  if (!transcriptContent && selectedTrack?.baseUrl) {
    const requestUrl = withJson3Format(selectedTrack.baseUrl);
    let rawJson = null;
    try {
      const inPage = await fetchTranscriptInPage(tabId, requestUrl);
      if (inPage?.ok && inPage.body) {
        rawJson = JSON.parse(inPage.body);
      } else if (inPage && !inPage.ok) {
        transcriptNote = `La descarga de subtítulos falló (HTTP ${inPage.status}${inPage.error ? `: ${inPage.error}` : ""}).`;
      } else if (inPage?.ok && !inPage.body) {
        transcriptNote = "YouTube devolvió una respuesta de subtítulos vacía (posible bloqueo anti-bot).";
      }
    } catch (error) {
      transcriptNote = `No se pudo interpretar la respuesta de subtítulos (${error?.message ?? error}).`;
    }

    if (!rawJson) {
      try {
        rawJson = await fetchJson(requestUrl);
      } catch (error) {
        transcriptNote = transcriptNote ?? `No se pudieron descargar los subtítulos (${error?.message ?? error}).`;
      }
    }

    if (rawJson) {
      const fallbackContent = parseJson3Transcript(rawJson);
      if (fallbackContent) {
        transcriptContent = fallbackContent;
        transcriptLanguage = selectedTrack.languageCode ?? uiBaseLanguage ?? "und";
        transcriptSource = captionTrackType(selectedTrack);
        transcriptNote = null;
      } else {
        transcriptNote = transcriptNote ?? "Los subtítulos descargados no contenían texto.";
      }
    }
  }

  if (!transcriptContent && !transcriptNote) {
    transcriptNote = tracks.length === 0
      ? "YouTube no expone pistas de subtítulos para este vídeo en el reproductor."
      : "No se pudo obtener la transcripción ni desde el panel ni desde el endpoint de subtítulos.";
  }

  const candidate = buildCaptureCandidate({
    metadata,
    tabUrl,
    videoId,
    transcriptContent,
    transcriptLanguage,
    transcriptSource,
    capturedAt: now(),
    pluginVersion: pluginVersion()
  });
  if (!candidate.has_transcript && transcriptNote) {
    candidate.transcript_note = transcriptNote;
  }
  return candidate;
}

export { getYoutubeVideoId } from "./metadata.js";
