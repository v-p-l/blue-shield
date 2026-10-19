importScripts('shared/options.js');

const { newEntry, STARTER } = globalThis.blueshieldOptions;

// The starter channel's current picture, read from its page. Falls back to the one saved in
// shared/options.js when the page can't be read (offline, or YouTube's consent page).
async function starterAvatar() {
  try {
    const html = await (await fetch(`https://www.youtube.com/channel/${STARTER.id}`, { credentials: 'include' })).text();
    return html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || STARTER.avatar;
  } catch {
    return STARTER.avatar;
  }
}

// First install only (not updates, not Chrome updates): add the starter channel, then open the
// welcome page. The list is written first so the welcome page shows it.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  const { channels = [] } = await chrome.storage.sync.get('channels');
  // A user reinstalling with Chrome sync on gets their old list back: leave it alone.
  if (!channels.length) {
    await chrome.storage.sync.set({ channels: [newEntry({ ...STARTER, avatar: await starterAvatar() })] });
  }
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
});
