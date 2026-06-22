const MESSAGE_TYPES = Object.freeze({ HEALTH_CHECK: "HEALTH_CHECK" });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPES.HEALTH_CHECK) return false;

  sendResponse({
    ok: true,
    version: chrome.runtime.getManifest().version
  });
  return false;
});
