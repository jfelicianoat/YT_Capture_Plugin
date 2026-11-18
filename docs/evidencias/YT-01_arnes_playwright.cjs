// YT-01: prueba de la extensión 0.1.1 cargada en Chromium con un vídeo de más de 2 horas.
// Perfil y descargas temporales: no toca el Chrome ni la carpeta de Descargas del usuario.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require(path.join(os.homedir(), ".claude/skills/gstack/node_modules/playwright"));

const EXT = "D:/Desarrollo/Proyectos TFM/YT_Capture_Plugin";
const VIDEO = "https://www.youtube.com/watch?v=L_Guz73e6fw";
const OUT = process.argv[2];

(async () => {
  const perfil = fs.mkdtempSync(path.join(OUT, "perfil-"));
  const descargas = path.join(OUT, "descargas");
  fs.mkdirSync(descargas, { recursive: true });
  const context = await chromium.launchPersistentContext(perfil, {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    downloadsPath: descargas,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 20000 });
  const extId = worker.url().split("/")[2];

  const yt = context.pages()[0] ?? (await context.newPage());
  await yt.goto(VIDEO, { waitUntil: "domcontentloaded" });
  await yt.waitForSelector("ytd-watch-metadata", { state: "attached", timeout: 30000 });
  await yt.waitForTimeout(5000);

  const popup = await context.newPage();
  // El popup busca «la pestaña activa de esta ventana»; aquí sería la suya propia.
  // El arnés le devuelve la de YouTube, que es lo que vería con el popup real.
  await popup.addInitScript(() => {
    const original = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = async (q) => {
      if (q && q.active) return (await original({})).filter((t) => (t.url || "").includes("youtube.com/watch"));
      return original(q);
    };
  });
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.waitForFunction(() => !document.querySelector("#capture-button").disabled, null, { timeout: 90000 });
  const detectado = {
    titulo: await popup.textContent("#video-title"),
    duracion: await popup.textContent("#video-duration"),
    transcripcion: await popup.textContent("#video-transcript")
  };
  const estados = [];
  const inicio = Date.now();
  await popup.click("#capture-button");
  let estado = "";
  for (let i = 0; i < 240; i += 1) {
    const ahora = await popup.textContent("#status-message");
    if (ahora !== estado) { estado = ahora; estados.push(`${((Date.now() - inicio) / 1000).toFixed(1)}s ${ahora}`); }
    if (/completada|interrump|no terminó|no se pudo|error/i.test(ahora)) break;
    await popup.waitForTimeout(500);
  }
  const items = await popup.evaluate(() => new Promise((r) => chrome.downloads.search({}, r)));
  const item = items[0];
  let fichero = null;
  if (item && item.filename && fs.existsSync(item.filename)) fichero = item.filename;
  else {
    const candidatos = fs.readdirSync(descargas).map((f) => path.join(descargas, f));
    fichero = candidatos[0] ?? null;
  }
  const md = fichero ? fs.readFileSync(fichero, "utf8") : "";
  const lineas = md.split("\n").filter((l) => /^\[\d\d:\d\d:\d\d\]/.test(l));
  console.log(JSON.stringify({
    extension: extId, detectado, estados,
    descarga: item ? { estado: item.state, bytes: item.bytesReceived, total: item.totalBytes, nombre: item.filename, error: item.error } : null,
    fichero, bytes_fichero: md.length, lineas_transcripcion: lineas.length,
    primera: lineas[0], ultima: lineas[lineas.length - 1],
    cierre_frontmatter: md.startsWith("---") && md.indexOf("\n---", 3) > 0
  }, null, 2));
  await context.close();
})().catch((e) => { console.error("FALLO", e); process.exit(1); });
