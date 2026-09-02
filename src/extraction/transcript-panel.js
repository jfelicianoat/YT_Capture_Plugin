import { parseClockDuration } from "./metadata.js";
import { formatTimestamp } from "./transcript.js";

// Enfoque A: leer la transcripción desde el panel "Mostrar transcripción" que
// YouTube renderiza en la propia página. Es el propio reproductor quien pide el
// texto a `youtubei/v1/get_transcript` con su token anti-bot (`pot`), así que
// aquí solo tenemos que abrir el panel y copiar los segmentos del DOM.

function normalizeSegmentText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parsePanelSegments(segments) {
  if (!Array.isArray(segments)) return "";
  const lines = [];
  for (const segment of segments) {
    const text = normalizeSegmentText(segment?.text);
    if (!text) continue;
    const rawTimestamp = typeof segment?.timestamp === "string" ? segment.timestamp.trim() : "";
    const seconds = parseClockDuration(rawTimestamp);
    const timestamp = seconds === null
      ? (rawTimestamp || "00:00:00")
      : formatTimestamp(seconds * 1000);
    lines.push(`[${timestamp}] ${text}`);
  }
  return lines.join("\n");
}

// Se ejecuta dentro de la pestaña de YouTube (world MAIN). Debe ser
// autocontenida: `chrome.scripting.executeScript` la serializa como texto.
async function scrapeTranscriptPanelInPage() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(getter, { tries, interval }) {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const value = getter();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  function readSegments() {
    const segments = [];

    // Vista moderna de transcripción (YouTube 2025+): `transcript-segment-view-model`.
    // El texto vive en un `span.ytAttributedStringHost` y la marca de tiempo en
    // `.ytwTranscriptSegmentViewModelTimestamp` (distinta del `...A11yLabel`).
    for (const node of document.querySelectorAll("transcript-segment-view-model")) {
      const timestamp = (node.querySelector(".ytwTranscriptSegmentViewModelTimestamp")?.textContent ?? "").trim();
      const text = (
        node.querySelector("span.ytAttributedStringHost")?.textContent
        ?? node.querySelector("[class*='SegmentText']")?.textContent
        ?? ""
      ).trim();
      if (text) segments.push({ timestamp, text });
    }
    if (segments.length) return segments;

    // Vista clásica: `ytd-transcript-segment-renderer`.
    for (const node of document.querySelectorAll("ytd-transcript-segment-renderer")) {
      const timestamp = (
        node.querySelector(".segment-timestamp")?.textContent
        ?? node.querySelector("[class*='timestamp']")?.textContent
        ?? ""
      ).trim();
      const text = (
        node.querySelector(".segment-text")?.textContent
        ?? node.querySelector("yt-formatted-string.segment-text")?.textContent
        ?? ""
      ).trim();
      if (text) segments.push({ timestamp, text });
    }
    return segments;
  }

  function findTranscriptButton() {
    const direct = document.querySelector(
      "ytd-video-description-transcript-section-renderer button, "
      + "ytd-video-description-transcript-section-renderer ytd-button-renderer button"
    );
    if (direct) return direct;
    const candidates = document.querySelectorAll(
      "button, a, tp-yt-paper-button, yt-button-shape button, ytd-menu-service-item-renderer"
    );
    for (const element of candidates) {
      const label = `${element.getAttribute?.("aria-label") ?? ""} ${element.textContent ?? ""}`.toLowerCase();
      if (label.includes("transcript") || label.includes("transcripci")) return element;
    }
    return null;
  }

  try {
    // ¿El panel ya estaba abierto?
    let segments = readSegments();
    if (segments.length) return { segments, opened: false };

    let button = findTranscriptButton();
    if (!button) {
      // El botón vive al final de la descripción; hay que expandirla.
      const expander = document.querySelector(
        "#description-inline-expander #expand, tp-yt-paper-button#expand, #expand.ytd-text-inline-expander"
      );
      if (expander) {
        expander.click();
        button = await waitFor(findTranscriptButton, { tries: 12, interval: 250 });
      }
    }
    if (!button) return { segments: [], opened: false, reason: "no-transcript-button" };

    button.click();
    segments = await waitFor(() => {
      const found = readSegments();
      return found.length ? found : null;
    }, { tries: 40, interval: 250 });

    // Cerrar el panel para dejar la página como estaba.
    const closeButton = [...document.querySelectorAll("button, tp-yt-paper-button, yt-icon-button")]
      .find((element) => /cerrar transcrip|close transcript/i.test(element.getAttribute?.("aria-label") ?? ""))
      ?? document.querySelector("ytd-engagement-panel-title-header-renderer #visibility-button button");
    if (closeButton) closeButton.click();

    if (!segments?.length) return { segments: [], opened: true, reason: "panel-empty" };
    return { segments, opened: true };
  } catch (error) {
    return { segments: [], opened: false, error: String(error?.message ?? error) };
  }
}

export async function openTranscriptPanelWithChrome(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: scrapeTranscriptPanelInPage
  });
  return results[0]?.result ?? null;
}
