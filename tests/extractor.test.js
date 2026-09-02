import assert from "node:assert/strict";
import test from "node:test";

import { validateCapture } from "../src/contracts/capture-validator.js";
import { ExtractionError, extractYoutubeVideo, fetchJsonWithBrowser } from "../src/extraction/extractor.js";
import { pageDataWithAllSources, transcriptJson3 } from "./fixtures/page-data.js";

const dependencies = {
  executeInPage: async () => pageDataWithAllSources,
  openTranscriptPanel: async () => ({ segments: [] }),
  fetchTranscriptInPage: async () => ({ ok: true, status: 200, body: JSON.stringify(transcriptJson3) }),
  fetchJson: async () => transcriptJson3,
  now: () => new Date("2026-06-22T12:00:00Z"),
  pluginVersion: () => "0.1.0"
};

const panelSegments = [
  { timestamp: "0:00", text: "Hola y bienvenidos" },
  { timestamp: "1:05", text: "Segunda línea" },
  { timestamp: "1:01:01", text: "Fin" }
];

test("extrae metadata y transcripción en un candidato contractual", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    dependencies
  );
  assert.equal(candidate.title, "Título desde Schema");
  assert.equal(candidate.transcript_source, "manual");
  assert.equal(candidate.transcript_language, "es-ES");
  assert.equal(validateCapture(candidate).valid, true);
});

test("degrada a captura sin transcripción si timedtext falla", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      fetchTranscriptInPage: async () => { throw new Error("no chrome"); },
      fetchJson: async () => { throw new Error("network"); }
    }
  );
  assert.equal(candidate.has_transcript, false);
  assert.equal(candidate.transcript_content, "");
  assert.match(candidate.transcript_note, /subtítulos/i);
  assert.equal(validateCapture(candidate).valid, true);
});

test("usa la descarga en el contexto de la página cuando el popup no puede", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      fetchTranscriptInPage: async () => ({ ok: true, status: 200, body: JSON.stringify(transcriptJson3) }),
      fetchJson: async () => { throw new Error("cuerpo vacío desde chrome-extension://"); }
    }
  );
  assert.equal(candidate.has_transcript, true);
  assert.equal(candidate.transcript_source, "manual");
  assert.ok(candidate.transcript_content.includes("Hola & bienvenidos"));
});

test("explica una respuesta de subtítulos vacía (bloqueo anti-bot)", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      fetchTranscriptInPage: async () => ({ ok: true, status: 200, body: "" }),
      fetchJson: async () => { throw new Error("Unexpected end of JSON input"); }
    }
  );
  assert.equal(candidate.has_transcript, false);
  assert.match(candidate.transcript_note, /vac[ií]a|anti-bot/i);
});

test("usa el panel de transcripción de YouTube como método principal", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      openTranscriptPanel: async () => ({ segments: panelSegments, opened: true }),
      fetchTranscriptInPage: async () => { throw new Error("no debería llamarse"); },
      fetchJson: async () => { throw new Error("no debería llamarse"); }
    }
  );
  assert.equal(candidate.has_transcript, true);
  assert.equal(candidate.transcript_source, "manual");
  assert.equal(candidate.transcript_language, "es-ES");
  assert.equal(
    candidate.transcript_content,
    "[00:00:00] Hola y bienvenidos\n[00:01:05] Segunda línea\n[01:01:01] Fin"
  );
  assert.equal(validateCapture(candidate).valid, true);
});

test("recurre a timedtext cuando el panel no devuelve segmentos", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      openTranscriptPanel: async () => ({ segments: [], reason: "panel-empty" }),
      fetchTranscriptInPage: async () => ({ ok: true, status: 200, body: JSON.stringify(transcriptJson3) })
    }
  );
  assert.equal(candidate.has_transcript, true);
  assert.ok(candidate.transcript_content.includes("Hola & bienvenidos"));
  assert.equal(candidate.transcript_note, undefined);
  assert.equal(validateCapture(candidate).valid, true);
});

test("informa cuando el vídeo no ofrece transcripción por ninguna vía", async () => {
  const candidate = await extractYoutubeVideo(
    { tabId: 1, tabUrl: pageDataWithAllSources.url },
    {
      ...dependencies,
      executeInPage: async () => ({ ...pageDataWithAllSources, captionTracks: [] }),
      openTranscriptPanel: async () => ({ segments: [], reason: "no-transcript-button" })
    }
  );
  assert.equal(candidate.has_transcript, false);
  assert.equal(candidate.transcript_content, "");
  assert.equal(candidate.transcript_source, null);
  assert.match(candidate.transcript_note, /no ofrece transcripci/i);
  assert.equal(validateCapture(candidate).valid, true);
});

test("rechaza páginas que no sean vídeos de YouTube", async () => {
  await assert.rejects(
    extractYoutubeVideo({ tabId: 1, tabUrl: "https://example.com" }, dependencies),
    (error) => error instanceof ExtractionError && error.code === "NOT_YOUTUBE_VIDEO"
  );
});

test("rechaza metadata sin título", async () => {
  await assert.rejects(
    extractYoutubeVideo(
      { tabId: 1, tabUrl: pageDataWithAllSources.url },
      { ...dependencies, executeInPage: async () => ({ ...pageDataWithAllSources, schema: null, globals: null, dom: {} }) }
    ),
    (error) => error instanceof ExtractionError && error.code === "TITLE_UNAVAILABLE"
  );
});

test("cancela una petición de subtítulos que supera el tiempo límite", async () => {
  let receivedSignal = null;
  const fetchFunction = (_url, options) => new Promise((_resolve, reject) => {
    receivedSignal = options.signal;
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });

  await assert.rejects(
    fetchJsonWithBrowser("https://www.youtube.com/api/timedtext", { fetchFunction, timeoutMs: 1 }),
    /aborted/
  );
  assert.equal(receivedSignal.aborted, true);
});
