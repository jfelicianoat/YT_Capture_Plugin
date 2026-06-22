import assert from "node:assert/strict";
import test from "node:test";

import { validateCapture } from "../src/contracts/capture-validator.js";
import { ExtractionError, extractYoutubeVideo } from "../src/extraction/extractor.js";
import { pageDataWithAllSources, transcriptJson3 } from "./fixtures/page-data.js";

const dependencies = {
  executeInPage: async () => pageDataWithAllSources,
  fetchJson: async () => transcriptJson3,
  now: () => new Date("2026-06-22T12:00:00Z"),
  pluginVersion: () => "0.1.0"
};

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
    { ...dependencies, fetchJson: async () => { throw new Error("network"); } }
  );
  assert.equal(candidate.has_transcript, false);
  assert.equal(candidate.transcript_content, "");
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
