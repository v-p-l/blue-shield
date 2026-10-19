// Test de fumée : charge l'extension dans un Chrome jetable et vérifie, sur le vrai
// YouTube, que rien ne fuit. À lancer après une mise à jour de YouTube ou des sélecteurs.
//
//   node tools/smoke.mjs            (fenêtre visible)
//   node tools/smoke.mjs --headless
//
// Le profil est temporaire : ni les chaînes ni les cookies du navigateur de l'utilisateur
// ne sont touchés. Sans connexion YouTube, une vidéo démarre par ~3 min de pubs : le test
// les attend, compte sur 5 bonnes minutes.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, loadExtension, withTab, sleep } from './cdp.mjs';

const EXTENSION = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HEADLESS = process.argv.includes('--headless');

// La chaîne témoin : ses vidéos durent des heures, donc toutes les fuites sont visibles.
const CHANNEL = {
  id: 'UCApmTE4So9oX7sPkDGgSpFQ',
  title: 'Karmine Corp Replay',
  handle: '@KarmineCorpVOD',
  hideProgress: true,
  hideComments: true,
  blurThumbs: true,
  blurTitles: true,
  addedAt: 0,
};
const CHANNEL_URL = `https://www.youtube.com/${CHANNEL.handle}/videos`;
const AD_TIMEOUT_MS = 240000;

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

// --- Pages ------------------------------------------------------------------------

async function setup(extensionId) {
  await withTab(`chrome-extension://${extensionId}/popup/popup.html`, async (page) => {
    await sleep(1200);
    await page.eval(`(async () => {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(${JSON.stringify({ enabled: true, language: 'fr', theme: 'dark', channels: [CHANNEL] })});
    })()`);
  });
}

async function openYouTube(page, url) {
  await page.send('Network.enable');
  // Sans ce cookie, l'Europe est redirigée vers la page de consentement.
  await page.send('Network.setCookie', {
    name: 'SOCS', value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmZyIAEaBgiA_LyaBg',
    domain: '.youtube.com', path: '/',
  });
  await page.viewport(1440, 900);
  await page.send('Page.navigate', { url });
  await sleep(9000);
}

async function checkChannelPage(page) {
  await openYouTube(page, CHANNEL_URL);
  const seen = JSON.parse(await page.eval(`(() => {
    const CARDS = 'ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-grid-video-renderer, ytd-playlist-renderer';
    const filterOf = (el) => (el ? getComputedStyle(el).filter : null);
    const card = document.querySelector('ytd-rich-item-renderer');
    const badge = card && card.querySelector('yt-thumbnail-badge-view-model, ytd-thumbnail-overlay-time-status-renderer');
    const blurredOutside = [...document.querySelectorAll('h3, #video-title')]
      .filter((el) => getComputedStyle(el).filter !== 'none' && !el.closest(CARDS))
      .map((el) => el.textContent.trim().slice(0, 24));
    return JSON.stringify({
      attr: document.documentElement.getAttribute('data-blueshield-thumbs'),
      badge: badge ? getComputedStyle(badge).display : 'absent',
      thumb: filterOf(card && card.querySelector('img')),
      title: filterOf(card && card.querySelector('h3, #video-title')),
      blurredOutside,
      firstVideo: (document.querySelector('ytd-rich-item-renderer a[href*="/watch?v="]') || {}).href || null,
    });
  })()`));

  check('page chaîne : attribut posé', seen.attr === 'all', `data-blueshield-thumbs=${seen.attr}`);
  check('page chaîne : badges de durée masqués', seen.badge === 'none' || seen.badge === 'absent', seen.badge);
  check('page chaîne : miniatures floutées', /blur\(/.test(seen.thumb || ''), seen.thumb);
  check('page chaîne : titres floutés', /blur\(/.test(seen.title || ''), seen.title);
  check('page chaîne : rien de flouté hors des cartes', seen.blurredOutside.length === 0, seen.blurredOutside.join(' / '));
  return seen.firstVideo;
}

// Déconnecté, YouTube sert des pubs non désactivables : on les passe ou on les attend.
async function waitForVideo(page) {
  const until = Date.now() + AD_TIMEOUT_MS;
  while (Date.now() < until) {
    const state = await page.eval(`(() => {
      const player = document.querySelector('#movie_player');
      const video = document.querySelector('video');
      if (video) video.muted = true;
      const skip = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button');
      if (skip) skip.click();
      return player && player.classList.contains('ad-showing') ? 'pub' : 'video';
    })()`);
    if (state === 'video') return true;
    await sleep(2500);
  }
  return false;
}

async function checkWatchPage(page, url) {
  await openYouTube(page, url);
  const playing = await waitForVideo(page);
  check('page vidéo : pubs passées', playing, playing ? '' : `toujours en pub après ${AD_TIMEOUT_MS / 1000} s`);
  if (!playing) return;

  // Ne pas avancer dans la vidéo : un saut déclenche une coupure pub, et la pub
  // n'est pas masquée (c'est voulu), ce qui ferait échouer les mesures.
  await sleep(2000);
  await waitForVideo(page);
  // Réveiller les contrôles pour qu'ils soient mesurables.
  await page.eval(`(() => { const p = document.querySelector('#movie_player'); if (p) p.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 600, clientY: 400 })); return 1; })()`);
  await sleep(800);

  const seen = JSON.parse(await page.eval(`(() => {
    const style = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : 'absent'; };
    const text = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : null; };
    // Une touche chiffre saute à X % : le timer trahirait la durée totale.
    let reached = false;
    const spy = () => { reached = true; };
    document.addEventListener('keydown', spy);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '5', code: 'Digit5', bubbles: true, cancelable: true }));
    document.removeEventListener('keydown', spy);
    const otherChannelBadge = [...document.querySelectorAll('ytd-compact-video-renderer, yt-lockup-view-model')]
      .map((card) => card.querySelector('yt-thumbnail-badge-view-model, ytd-thumbnail-overlay-time-status-renderer'))
      .find((badge) => badge && getComputedStyle(badge).display !== 'none');
    return JSON.stringify({
      attr: document.documentElement.getAttribute('data-blueshield-player'),
      // Une pub en cours garde barre et durée : c'est voulu, mais alors les mesures ne valent rien.
      adShowing: !!document.querySelector('#movie_player.ad-showing'),
      progressBar: style('.ytp-progress-bar-container', 'visibility'),
      duration: style('.ytp-time-duration', 'display'),
      current: text('.ytp-time-current'),
      seekButtons: [...document.querySelectorAll('.blueshield-controls button')].map((b) => b.textContent.trim()),
      comments: text('#blueshield-comments'),
      digitBlocked: !reached,
      mediaSessionPatched: !String(MediaSession.prototype.setPositionState).includes('[native code]'),
      otherChannelDuration: otherChannelBadge ? otherChannelBadge.textContent.trim() : null,
    });
  })()`));

  const adNote = seen.adShowing ? ' (pub en cours : mesure faussée)' : '';
  check('lecteur : attribut posé', seen.attr === 'on', `data-blueshield-player=${seen.attr}`);
  check('lecteur : barre de progression masquée', seen.progressBar === 'hidden', seen.progressBar + adNote);
  check('lecteur : durée totale retirée', seen.duration === 'none', seen.duration + adNote);
  check('lecteur : temps écoulé visible', /\d+:\d\d/.test(seen.current || ''), seen.current);
  check('lecteur : boutons de saut présents', seen.seekButtons.length >= 4, seen.seekButtons.join(' '));
  check('lecteur : touches 0-9 bloquées', seen.digitBlocked);
  check('lecteur : durée factice pour les contrôles média', seen.mediaSessionPatched);
  check('page vidéo : commentaires masqués', !!seen.comments, seen.comments || 'placeholder absent');
  check('contre-test : les autres chaînes gardent leur durée', !!seen.otherChannelDuration, seen.otherChannelDuration || 'aucune miniature trouvée');
}

// --- Exécution --------------------------------------------------------------------

const chrome = await launchChrome({ headless: HEADLESS });
try {
  const extensionId = await loadExtension(chrome.version.webSocketDebuggerUrl, EXTENSION);
  console.log(`extension ${extensionId} chargée depuis ${EXTENSION}\n`);
  await setup(extensionId);
  const videoUrl = await withTab('about:blank', checkChannelPage);
  if (videoUrl) await withTab('about:blank', (page) => checkWatchPage(page, videoUrl));
  else check('page chaîne : lien de vidéo trouvé', false, 'aucune carte vidéo');
} finally {
  chrome.close();
}

for (const { name, ok, detail } of results) {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? `  — ${detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} vérifications passées`);
process.exit(failed ? 1 : 0);
