// YT-01, destino: Chromium lanzado a mano (sin la intercepción de descargas de Playwright),
// con un perfil temporal cuya carpeta de descargas es temporal. Comprueba que la extensión
// deja el fichero en <descargas>/YT-Knowledge-Inbox/<fecha> - <título>.md.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { chromium } = require(path.join(os.homedir(), ".claude/skills/gstack/node_modules/playwright"));

const EXT = "D:/Desarrollo/Proyectos TFM/YT_Capture_Plugin";
const VIDEO = "https://www.youtube.com/watch?v=L_Guz73e6fw";
const OUT = process.argv[2];

(async () => {
  const perfil = path.join(OUT, "perfil");
  const descargas = path.join(OUT, "Descargas");
  fs.mkdirSync(path.join(perfil, "Default"), { recursive: true });
  fs.mkdirSync(descargas, { recursive: true });
  fs.writeFileSync(path.join(perfil, "Default", "Preferences"), JSON.stringify({
    download: { default_directory: descargas, prompt_for_download: false, directory_upgrade: true },
    savefile: { default_directory: descargas }
  }));
  const exe = chromium.executablePath();
  const puerto = 9333;
  const proceso = spawn(exe, [
    `--user-data-dir=${perfil}`, `--remote-debugging-port=${puerto}`, "--headless=new",
    "--no-first-run", "--no-default-browser-check",
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"
  ], { stdio: "ignore" });
  try {
    let browser;
    for (let i = 0; i < 40 && !browser; i += 1) {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${puerto}`); } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    const context = browser.contexts()[0];
    // Playwright desvía las descargas a su carpeta; se devuelve el comportamiento normal de Chrome.
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "default" });
    const nuestro = (w) => w.url().endsWith("/src/background.js");
    let worker = context.serviceWorkers().find(nuestro);
    if (!worker) worker = await context.waitForEvent("serviceworker", { predicate: nuestro, timeout: 20000 });
    const extId = worker.url().split("/")[2];
    const yt = await context.newPage();
    await yt.goto(VIDEO, { waitUntil: "domcontentloaded" });
    await yt.waitForSelector("ytd-watch-metadata", { state: "attached", timeout: 30000 });
    await yt.waitForTimeout(5000);
    const popup = await context.newPage();
    await popup.addInitScript(() => {
      const original = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (q) => (q && q.active)
        ? (await original({})).filter((t) => (t.url || "").includes("youtube.com/watch"))
        : original(q);
    });
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForFunction(() => !document.querySelector("#capture-button").disabled, null, { timeout: 90000 });
    await popup.click("#capture-button");
    let estado = "";
    for (let i = 0; i < 240; i += 1) {
      estado = await popup.textContent("#status-message");
      if (/completada|interrump|no terminó|no se pudo|error/i.test(estado)) break;
      await popup.waitForTimeout(500);
    }
    const [item] = await popup.evaluate(() => new Promise((r) => chrome.downloads.search({}, r)));
    const bandeja = path.join(descargas, "YT-Knowledge-Inbox");
    const ficheros = fs.existsSync(bandeja) ? fs.readdirSync(bandeja) : [];
    const md = ficheros[0] ? fs.readFileSync(path.join(bandeja, ficheros[0]), "utf8") : "";
    console.log(JSON.stringify({
      estado_popup: estado,
      descarga: item && { estado: item.state, bytes: item.bytesReceived, total: item.totalBytes, ruta: item.filename },
      bandeja, ficheros,
      lineas_transcripcion: md.split("\n").filter((l) => /^\[\d\d:\d\d:\d\d\]/.test(l)).length,
      ultima: md.trimEnd().split("\n").filter((l) => /^\[\d\d:\d\d:\d\d\]/.test(l)).pop()
    }, null, 2));
    await browser.close();
  } finally {
    proceso.kill();
  }
})().catch((e) => { console.error("FALLO", e); process.exit(1); });
