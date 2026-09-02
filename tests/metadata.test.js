import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaptureCandidate,
  getYoutubeVideoId,
  normalizePublishedDate,
  parseClockDuration,
  parseIsoDuration,
  selectMetadata
} from "../src/extraction/metadata.js";
import { pageDataWithAllSources } from "./fixtures/page-data.js";

test("reconoce URLs watch, shorts y live de YouTube", () => {
  assert.equal(getYoutubeVideoId("https://www.youtube.com/watch?v=abc123&list=1"), "abc123");
  assert.equal(getYoutubeVideoId("https://www.youtube.com/shorts/short123"), "short123");
  assert.equal(getYoutubeVideoId("https://youtube.com/live/live123"), "live123");
  assert.equal(getYoutubeVideoId("https://example.com/watch?v=abc123"), null);
});

test("convierte duraciones ISO y de reloj", () => {
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("PT28M45S"), 1725);
  assert.equal(parseClockDuration("1:02:03"), 3723);
  assert.equal(parseClockDuration("28:45"), 1725);
});

test("normaliza la fecha de publicación al formato YYYY-MM-DD", () => {
  assert.equal(normalizePublishedDate("2024-05-10"), "2024-05-10");
  assert.equal(normalizePublishedDate("2024-05-10T00:00:00-07:00"), "2024-05-10");
  assert.equal(normalizePublishedDate("2024-05-10T07:00:00Z"), "2024-05-10");
  assert.equal(normalizePublishedDate(null), null);
  assert.equal(normalizePublishedDate("10 de mayo de 2024"), null);
});

test("selectMetadata recorta fechas ISO completas de Schema y globals", () => {
  const withIsoDates = {
    ...pageDataWithAllSources,
    schema: { ...pageDataWithAllSources.schema, publishedDate: "2026-06-01T00:00:00-07:00" }
  };
  assert.equal(selectMetadata(withIsoDates, withIsoDates.url).publishedDate, "2026-06-01");

  const globalsOnly = {
    ...pageDataWithAllSources,
    schema: null,
    globals: { ...pageDataWithAllSources.globals, publishedDate: "2026-05-01T12:34:56Z" }
  };
  assert.equal(selectMetadata(globalsOnly, globalsOnly.url).publishedDate, "2026-05-01");
});

test("prioriza Schema sobre globals y DOM", () => {
  const metadata = selectMetadata(pageDataWithAllSources, pageDataWithAllSources.url);
  assert.equal(metadata.title, "Título desde Schema");
  assert.equal(metadata.durationSeconds, 3723);
  assert.equal(metadata.extractionMethod, "schema_jsonld");
});

test("usa globals cuando Schema no está disponible", () => {
  const metadata = selectMetadata({ ...pageDataWithAllSources, schema: null }, pageDataWithAllSources.url);
  assert.equal(metadata.title, "Título global");
  assert.equal(metadata.extractionMethod, "yt_globals");
});

test("usa DOM como último fallback", () => {
  const metadata = selectMetadata({ ...pageDataWithAllSources, schema: null, globals: null }, pageDataWithAllSources.url);
  assert.equal(metadata.title, "Título DOM");
  assert.equal(metadata.durationSeconds, 90);
  assert.equal(metadata.extractionMethod, "dom_selectors");
});

test("construye un candidato sin inventar transcripción", () => {
  const metadata = selectMetadata(pageDataWithAllSources, pageDataWithAllSources.url);
  const candidate = buildCaptureCandidate({
    metadata,
    tabUrl: pageDataWithAllSources.url,
    videoId: "abc123",
    transcriptContent: "",
    transcriptLanguage: null,
    transcriptSource: null,
    capturedAt: new Date("2026-06-22T12:00:00Z"),
    pluginVersion: "0.1.0"
  });
  assert.equal(candidate.capture_id, "yt_20260622_120000Z_abc123");
  assert.equal(candidate.has_transcript, false);
  assert.equal(candidate.transcript_source, null);
});
