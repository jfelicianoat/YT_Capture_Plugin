export function collectYoutubePageData() {
  function textFrom(selectors) {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return null;
  }

  function hrefFrom(selectors) {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.href;
      if (value) return value;
    }
    return null;
  }

  function findVideoObject(value) {
    if (!value || typeof value !== "object") return null;
    if (value["@type"] === "VideoObject") return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = findVideoObject(item);
        if (match) return match;
      }
    }
    if (Array.isArray(value["@graph"])) return findVideoObject(value["@graph"]);
    return null;
  }

  let schema = null;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      schema = findVideoObject(JSON.parse(script.textContent));
      if (schema) break;
    } catch {
      // Ignorar bloques JSON-LD ajenos o incompletos.
    }
  }

  const player = window.ytInitialPlayerResponse ?? null;
  const details = player?.videoDetails ?? null;
  const microformat = player?.microformat?.playerMicroformatRenderer ?? null;
  const captionTracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return {
    url: window.location.href,
    uiLanguage: document.documentElement.lang || navigator.language || null,
    schema: schema ? {
      title: schema.name ?? null,
      channel: schema.author?.name ?? null,
      channelUrl: schema.author?.url ?? null,
      duration: schema.duration ?? null,
      publishedDate: schema.uploadDate ?? null
    } : null,
    globals: details ? {
      title: details.title ?? null,
      channel: details.author ?? null,
      channelUrl: microformat?.ownerProfileUrl ?? null,
      durationSeconds: Number(details.lengthSeconds),
      publishedDate: microformat?.publishDate ?? microformat?.uploadDate ?? null
    } : null,
    dom: {
      title: textFrom(["h1.ytd-watch-metadata yt-formatted-string", "h1.ytd-videoPrimaryInfoRenderer", "h1[class*='title']"]),
      channel: textFrom(["#channel-name a", "ytd-channel-name a", ".ytd-channel-name a"]),
      channelUrl: hrefFrom(["#channel-name a", "ytd-channel-name a", ".ytd-channel-name a"]),
      durationText: textFrom([".ytp-time-duration"])
    },
    captionTracks: captionTracks.map((track) => ({
      baseUrl: track.baseUrl ?? null,
      languageCode: track.languageCode ?? null,
      kind: track.kind ?? null,
      isTranslatable: Boolean(track.isTranslatable),
      name: track.name?.simpleText ?? track.name?.runs?.map((run) => run.text).join("") ?? null
    }))
  };
}
