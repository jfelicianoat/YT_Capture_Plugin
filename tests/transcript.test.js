import assert from "node:assert/strict";
import test from "node:test";

import {
  captionTrackType,
  formatTimestamp,
  parseJson3Transcript,
  selectCaptionTrack,
  withJson3Format
} from "../src/extraction/transcript.js";
import { pageDataWithAllSources, transcriptJson3 } from "./fixtures/page-data.js";

test("prioriza pista manual del idioma preferido", () => {
  const selected = selectCaptionTrack(pageDataWithAllSources.captionTracks, "es-MX");
  assert.equal(selected.languageCode, "es-ES");
  assert.equal(captionTrackType(selected), "manual");
});

test("usa pista automática del idioma cuando no hay manual", () => {
  const tracks = pageDataWithAllSources.captionTracks.filter((track) => track.languageCode !== "es-ES");
  assert.equal(captionTrackType(selectCaptionTrack(tracks, "es")), "automatic");
});

test("usa la primera pista como fallback final", () => {
  assert.equal(selectCaptionTrack(pageDataWithAllSources.captionTracks, "fr"), pageDataWithAllSources.captionTracks[0]);
  assert.equal(selectCaptionTrack([], "es"), null);
});

test("fuerza fmt=json3 conservando parámetros", () => {
  const result = new URL(withJson3Format("https://www.youtube.com/api/timedtext?v=1&fmt=vtt"));
  assert.equal(result.searchParams.get("v"), "1");
  assert.equal(result.searchParams.get("fmt"), "json3");
});

test("convierte eventos json3 a líneas normalizadas", () => {
  assert.equal(
    parseJson3Transcript(transcriptJson3),
    "[00:00:00] Hola & bienvenidos\n[00:01:05] Segunda línea\n[01:01:01] Fin"
  );
  assert.equal(parseJson3Transcript({}), "");
});

test("formatea timestamps negativos o largos", () => {
  assert.equal(formatTimestamp(-100), "00:00:00");
  assert.equal(formatTimestamp(3_661_000), "01:01:01");
});

test("ordena eventos json3 cronológicamente de forma estable", () => {
  const transcript = parseJson3Transcript({
    events: [
      { tStartMs: 5000, segs: [{ utf8: "tercero" }] },
      { tStartMs: 1000, segs: [{ utf8: "primero" }] },
      { tStartMs: 1000, segs: [{ utf8: "segundo" }] }
    ]
  });
  assert.equal(
    transcript,
    "[00:00:01] primero\n[00:00:01] segundo\n[00:00:05] tercero"
  );
});

test("conserva entidades numéricas inválidas sin lanzar excepciones", () => {
  assert.equal(
    parseJson3Transcript({ events: [{ tStartMs: 0, segs: [{ utf8: "Valor &#x110000; y &#xD800;" }] }] }),
    "[00:00:00] Valor &#x110000; y &#xD800;"
  );
});
