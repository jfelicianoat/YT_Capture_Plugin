const captureButton = document.querySelector("#capture-button");
const statusMessage = document.querySelector("#status-message");

function setStatus(message, state = "idle") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

async function initializePopup() {
  try {
    const health = await chrome.runtime.sendMessage({ type: "HEALTH_CHECK" });
    if (!health?.ok) throw new Error("El service worker no respondió correctamente");
    captureButton.disabled = true;
    setStatus(`Estructura v${health.version} lista. La detección se habilitará en la fase 2.`);
  } catch (error) {
    captureButton.disabled = true;
    setStatus(`No se pudo iniciar la extensión: ${error.message}`, "error");
  }
}

initializePopup();
