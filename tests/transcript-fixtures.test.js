// YT-03: el marcado real de YouTube guardado en tests/fixtures/youtube sigue teniendo
// lo que buscan los selectores de la extensión. Si YouTube cambia el panel, al refrescar
// la fixture este test dice qué selector dejó de encontrar su elemento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TRANSCRIPT_SELECTORS as SEL, parsePanelSegments } from "../src/extraction/transcript-panel.js";

const FIXTURE = new URL("./fixtures/youtube/transcripcion-moderna-lex-fridman-367.html", import.meta.url);
const ESPERADO = new URL("./fixtures/youtube/transcripcion-moderna-lex-fridman-367.esperado.json", import.meta.url);

// Emparejador mínimo para los selectores simples que usa la extensión:
// `etiqueta`, `.clase` y `etiqueta.clase`, con la clase como token completo.
function compile(selector) {
  const match = /^([a-z][\w-]*)?(?:\.([\w-]+))?$/i.exec(selector);
  assert.ok(match, `selector no soportado por el emparejador del test: ${selector}`);
  const [, tag, cls] = match;
  const tagPart = tag ?? "[a-z][\\w-]*";
  const classPart = cls ? `[^>]*\\bclass="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"` : "";
  return new RegExp(`<(${tagPart})\\b${classPart}[^>]*>([\\s\\S]*?)</\\1>`, "i");
}

function textOf(html, selector) {
  const found = compile(selector).exec(html);
  return found ? found[2].replace(/<[^>]+>/g, "").trim() : null;
}

function segments(html) {
  const open = `<${SEL.modernSegment}`;
  return html.split(open).slice(1).map((chunk) => ({
    timestamp: textOf(chunk, SEL.modernTimestamp) ?? "",
    text: textOf(chunk, SEL.modernText) ?? ""
  }));
}

test("la vista moderna guardada tiene segmentos, marca de tiempo y texto donde los busca la extensión", () => {
  const html = readFileSync(FIXTURE, "utf8");
  const esperado = JSON.parse(readFileSync(ESPERADO, "utf8"));
  const leidos = segments(html);
  assert.equal(leidos.length, esperado.segmentos, `no aparece ${SEL.modernSegment}`);
  for (const [i, segmento] of leidos.entries()) {
    assert.ok(segmento.timestamp, `segmento ${i}: ${SEL.modernTimestamp} no encontrado`);
    assert.ok(segmento.text, `segmento ${i}: ${SEL.modernText} no encontrado`);
  }
  assert.deepEqual(leidos.slice(0, esperado.primeros.length), esperado.primeros);
  assert.match(parsePanelSegments(leidos), /^\[00:00:00\] - We have been a misunderstood/);
});

test("la marca accesible no se confunde con la marca visible", () => {
  const html = '<div class="ytwTranscriptSegmentViewModelTimestampA11yLabel">0 segundos</div>';
  assert.equal(textOf(html, SEL.modernTimestamp), null);
});
