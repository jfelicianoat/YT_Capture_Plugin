import { collectYoutubePageData } from "./page-context.js";
import { buildCaptureCandidate, getYoutubeVideoId, selectMetadata } from "./metadata.js";
import { captionTrackType, parseJson3Transcript, selectCaptionTrack, withJson3Format } from "./transcript.js";

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

async function fetchJsonWithBrowser(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function extractYoutubeVideo(
  { tabId, tabUrl },
  {
    executeInPage = executeInPageWithChrome,
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
  const selectedTrack = selectCaptionTrack(pageData.captionTracks ?? [], pageData.uiLanguage);

  if (selectedTrack?.baseUrl) {
    try {
      const transcriptJson = await fetchJson(withJson3Format(selectedTrack.baseUrl));
      transcriptContent = parseJson3Transcript(transcriptJson);
      if (transcriptContent) {
        transcriptLanguage = selectedTrack.languageCode ?? null;
        transcriptSource = captionTrackType(selectedTrack);
      }
    } catch {
      transcriptContent = "";
    }
  }

  return buildCaptureCandidate({
    metadata,
    tabUrl,
    videoId,
    transcriptContent,
    transcriptLanguage,
    transcriptSource,
    capturedAt: now(),
    pluginVersion: pluginVersion()
  });
}

export { getYoutubeVideoId } from "./metadata.js";
