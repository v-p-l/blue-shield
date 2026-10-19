// Runs in YouTube's own JS world: reads internal player data the isolated
// content script cannot see, and feeds a fake timeline to the OS media controls.
(() => {
  'use strict';

  const FAKE_DURATION = 35999; // 9:59:59 in Windows / Chrome media controls
  const root = document.documentElement;
  const isMasked = () => ['on', 'pending'].includes(root.dataset.blueshieldPlayer); // not "revealed"

  let context = {};
  let lastSent = '';

  function send(force) {
    const json = JSON.stringify(context);
    if (!force && json === lastSent) return;
    lastSent = json;
    document.dispatchEvent(new CustomEvent('blueshield:context', { detail: json }));
  }

  function setVideo(details) {
    if (!details?.videoId) return;
    if (details.videoId === context.videoId && details.channelId === context.channelId) return;
    context = { ...context, videoId: details.videoId, channelId: details.channelId, author: details.author };
    send();
  }

  function setChannel(meta) {
    context = {
      ...context,
      browseId: meta?.externalId || null,
      browseTitle: meta?.title || null,
      browseHandle: meta?.vanityChannelUrl?.match(/\/(@[^/?#]+)/)?.[1] || null,
      browseAvatar: meta?.avatar?.thumbnails?.[0]?.url || null,
    };
    send();
  }

  function readPlayer() {
    setVideo(document.getElementById('movie_player')?.getPlayerResponse?.()?.videoDetails);
  }

  document.addEventListener('yt-navigate-finish', (e) => {
    const response = e.detail?.response;
    setVideo(response?.playerResponse?.videoDetails);
    setChannel(response?.response?.metadata?.channelMetadataRenderer);
  });

  document.addEventListener('DOMContentLoaded', () => {
    setVideo(window.ytInitialPlayerResponse?.videoDetails);
    setChannel(window.ytInitialData?.metadata?.channelMetadataRenderer);
  });

  document.addEventListener('blueshield:request', () => send(true));

  // YouTube reports the real duration to navigator.mediaSession; while masked
  // we swallow its updates and publish a fake 9:59:59 timeline instead.
  const realSetPositionState = window.MediaSession?.prototype.setPositionState;
  if (realSetPositionState) {
    window.MediaSession.prototype.setPositionState = function (state) {
      if (isMasked()) return;
      return realSetPositionState.call(this, state);
    };
  }

  let wasMasked = false;
  function feedMediaSession() {
    if (!realSetPositionState) return;
    const masked = isMasked();
    const video = document.querySelector('#movie_player video');
    try {
      if (masked && video && Number.isFinite(video.currentTime)) {
        realSetPositionState.call(navigator.mediaSession, {
          duration: FAKE_DURATION,
          position: Math.min(video.currentTime, FAKE_DURATION),
          playbackRate: video.playbackRate || 1,
        });
      } else if (wasMasked) {
        realSetPositionState.call(navigator.mediaSession);
      }
    } catch {
      // Invalid state (e.g. during source switch): retry on next tick.
    }
    wasMasked = masked;
  }

  setInterval(() => {
    readPlayer();
    feedMediaSession();
  }, 500);
})();
