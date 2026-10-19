// Turning a link / handle / ID into a channel { id, title, handle, avatar }, and reading the
// signed-in user's subscriptions. Shared by the popup and the welcome page (ES module).
// The per-channel anti-spoil options live in shared/options.js.

export const YT = 'https://www.youtube.com';

export const nameOf = (c) => c.title || c.handle || c.id;

// Search by name or @handle, case- and accent-insensitive: "elite" finds "Élite".
const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export const matchesQuery = (c, query) => !query.trim() || normalize(`${c.title || ''} ${c.handle || ''}`).includes(normalize(query.trim()));

// Errors carry an i18n key (shared/i18n.js); the caller translates it.
const fail = (i18nKey) => Object.assign(new Error(i18nKey), { i18nKey });

function toUrl(raw) {
  const input = raw.trim();
  const id = input.match(/\bUC[\w-]{22}\b/)?.[0];
  if (id) return `${YT}/channel/${id}`;
  if (/^@[^\s/]+$/.test(input)) return `${YT}/${input}`;
  if (/^[\w.-]{3,}$/.test(input)) return `${YT}/@${input}`;
  if (!/(^|\/\/|\.)(youtube\.com|youtu\.be)\//i.test(input)) return null;
  // Normalise m.youtube.com, music.youtube.com, youtu.be/ID to www.youtube.com.
  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (url.hostname === 'youtu.be') return `${YT}/watch?v=${url.pathname.slice(1)}`;
  return `${YT}${url.pathname}${url.search}`;
}

async function fetchPage(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (res.url.includes('consent.youtube.com')) throw fail('errorConsent');
  if (!res.ok) throw fail('errorNotFound');
  return res.text();
}

function parseChannelPage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const canonical = doc.querySelector('link[rel="canonical"]')?.href || '';
  const id = canonical.match(/\/channel\/(UC[\w-]{22})/)?.[1];
  if (!id) return null;
  const vanity = html.match(/"vanityChannelUrl":"[^"]*?\/(@[^"/?]+)"/)?.[1];
  return {
    id,
    title: doc.querySelector('meta[property="og:title"]')?.content || id,
    handle: vanity ? decodeURIComponent(vanity) : null,
    avatar: doc.querySelector('meta[property="og:image"]')?.content || null,
  };
}

// Full details of a channel known by its ID (avatar, handle). Null if the page can't be read.
export async function fetchChannel(id) {
  return parseChannelPage(await fetchPage(`${YT}/channel/${id}`));
}

// The signed-in user's subscriptions, read from the data embedded in youtube.com/feed/channels.
// Only the first page YouTube sends (no continuation); [] when signed out.
export async function fetchSubscriptions() {
  const html = await fetchPage(`${YT}/feed/channels`);
  const json = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  if (!json) return [];
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.channelRenderer) found.push(node.channelRenderer);
    else for (const value of Object.values(node)) walk(value);
  })(JSON.parse(json));
  return found.filter((r) => r.channelId).map((r) => {
    const handle = r.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl?.match(/^\/(@[^/?]+)/)?.[1];
    const avatar = r.thumbnail?.thumbnails?.at(-1)?.url;
    return {
      id: r.channelId,
      title: r.title?.simpleText || r.channelId,
      handle: handle ? decodeURIComponent(handle) : null,
      avatar: avatar ? new URL(avatar, YT).href : null, // URLs come protocol-relative ("//yt3…")
    };
  });
}

export async function resolveChannel(raw) {
  const url = toUrl(raw);
  if (!url) throw fail('errorBadLink');
  const html = await fetchPage(url);
  const channel = parseChannelPage(html);
  if (channel) return channel;
  // A video link: find its channel, then load the channel page.
  const channelId = html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
  if (channelId) return (await fetchChannel(channelId)) || { id: channelId, title: channelId };
  throw fail('errorNoChannel');
}
