import assert from "node:assert/strict";
import test from "node:test";

import { parsePanelSegments } from "../src/extraction/transcript-panel.js";

test("convierte segmentos del panel a líneas [HH:MM:SS] normalizadas", () => {
  const transcript = parsePanelSegments([
    { timestamp: "0:00", text: "Hola  y   bienvenidos" },
    { timestamp: "1:05", text: "Segunda línea" },
    { timestamp: "1:01:01", text: "Fin" }
  ]);
  assert.equal(
    transcript,
    "[00:00:00] Hola y bienvenidos\n[00:01:05] Segunda línea\n[01:01:01] Fin"
  );
});

test("omite segmentos sin texto y recorta espacios", () => {
  const transcript = parsePanelSegments([
    { timestamp: "0:01", text: "  " },
    { timestamp: "0:02", text: "\n  contenido \n" },
    { timestamp: "0:03", text: "" }
  ]);
  assert.equal(transcript, "[00:00:02] contenido");
});

test("conserva la marca original si no es un reloj válido", () => {
  assert.equal(
    parsePanelSegments([{ timestamp: "??", text: "texto" }]),
    "[??] texto"
  );
  assert.equal(
    parsePanelSegments([{ timestamp: "", text: "sin marca" }]),
    "[00:00:00] sin marca"
  );
});

test("devuelve cadena vacía ante entradas no válidas", () => {
  assert.equal(parsePanelSegments(null), "");
  assert.equal(parsePanelSegments([]), "");
  assert.equal(parsePanelSegments(undefined), "");
});
