export const pageDataWithAllSources = Object.freeze({
  url: "https://www.youtube.com/watch?v=abc123",
  uiLanguage: "es-ES",
  schema: {
    title: "Título desde Schema",
    channel: "Canal Schema",
    channelUrl: "https://www.youtube.com/@schema",
    duration: "PT1H2M3S",
    publishedDate: "2026-06-01"
  },
  globals: {
    title: "Título global",
    channel: "Canal global",
    channelUrl: "https://www.youtube.com/@global",
    durationSeconds: 90,
    publishedDate: "2026-05-01"
  },
  dom: {
    title: "Título DOM",
    channel: "Canal DOM",
    channelUrl: "https://www.youtube.com/@dom",
    durationText: "01:30"
  },
  captionTracks: [
    { baseUrl: "https://www.youtube.com/api/timedtext?id=auto-es", languageCode: "es", kind: "asr", name: "Español automático" },
    { baseUrl: "https://www.youtube.com/api/timedtext?id=manual-en", languageCode: "en", kind: null, name: "English" },
    { baseUrl: "https://www.youtube.com/api/timedtext?id=manual-es", languageCode: "es-ES", kind: null, name: "Español" }
  ]
});

export const transcriptJson3 = Object.freeze({
  events: [
    { tStartMs: 0, segs: [{ utf8: "Hola " }, { utf8: "&amp; bienvenidos" }] },
    { tStartMs: 65_000, segs: [{ utf8: "Segunda línea\n" }] },
    { tStartMs: 70_000 },
    { tStartMs: 3_661_000, segs: [{ utf8: "Fin" }] }
  ]
});
