// Isolated-world content script: decides what to mask and tells the CSS
// through data-blueshield-* attributes on <html>.
(() => {
  'use strict';

  // Classic scripts loaded before this one (see the manifest).
  const { ICONS, svg, el } = globalThis.blueshieldDom;
  const t = (key) => globalThis.blueshieldI18n.t(settings.language, key);
  // Per-channel options; option(channel, key) falls back to the option's default.
  const option = globalThis.blueshieldOptions.get;

  const root = document.documentElement;
  const DEFAULTS = { enabled: true, channels: [], language: null }; // language: see shared/i18n.js

  // Video cards, their duration badges and their thumbnails.
  const CARDS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'yt-lockup-view-model',
  ].join(',');
  const BADGES = [
    'yt-thumbnail-badge-view-model',
    'ytd-thumbnail-overlay-time-status-renderer',
    'ytd-thumbnail-overlay-resume-playback-renderer',
    'yt-thumbnail-overlay-progress-bar-view-model',
  ].join(',');
  const THUMBS = 'yt-thumbnail-view-model, ytd-thumbnail, ytd-playlist-thumbnail';
  const TITLES = 'h3, #video-title, .ytLockupMetadataViewModelTitle';
  // On the channel's own page every card is hers, but the rules must still stay inside a card:
  // the left menu titles ("Explorer") are <h3> too, and they were getting blurred.
  const PAGE_CARDS = [
    CARDS,
    'ytd-playlist-renderer',
    'ytd-grid-playlist-renderer',
    'ytd-reel-item-renderer',
    'ytm-shorts-lockup-view-model',
  ].join(',');
  // Eye-off in a dark disc, drawn over blurred thumbnails so the blur reads as intentional.
  // Same paths as the eyeOff icon, scaled into a 48px disc.
  const BLUR_BADGE = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="24" r="24" fill="#000" fill-opacity=".5"/>' +
    '<g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ICONS.eyeOff.map((d) => `<path d="${d}"/>`).join('') +
    '</g></svg>',
  );

  let settings = DEFAULTS;
  let settingsLoaded = false;
  let context = {}; // from main-world.js: videoId, channelId, author, browseId…

  const lower = (s) => (s || '').toLowerCase();
  const isOn = () => settings.enabled && settings.channels.length > 0;
  const findById = (id) => (id ? settings.channels.find((c) => c.id === id) : undefined);
  const findByHandle = (h) => (h ? settings.channels.find((c) => lower(c.handle) === lower(h)) : undefined);

  function pageInfo() {
    const { pathname, searchParams } = new URL(location.href);
    if (pathname === '/watch') return { kind: 'watch', videoId: searchParams.get('v') };
    let m = pathname.match(/^\/live\/([\w-]{11})/);
    if (m) return { kind: 'watch', videoId: m[1] };
    m = pathname.match(/^\/(@[^/]+)/);
    if (m) return { kind: 'channel', handle: decodeURIComponent(m[1]) };
    m = pathname.match(/^\/channel\/(UC[\w-]{22})/);
    if (m) return { kind: 'channel', id: m[1] };
    if (/^\/(c|user)\//.test(pathname)) return { kind: 'channel' };
    return { kind: 'other' };
  }

  // --- Per-video "reveal", kept for the tab's lifetime ----------------------

  const REVEAL_KEY = 'blueshield:revealed';
  function readReveals() {
    try {
      return JSON.parse(sessionStorage.getItem(REVEAL_KEY)) || {};
    } catch {
      return {};
    }
  }
  const isRevealed = (videoId, part) => !!readReveals()[videoId]?.[part];
  function setRevealed(part, value) {
    if (!context.videoId) return;
    const all = readReveals();
    all[context.videoId] = { ...all[context.videoId], [part]: value };
    try {
      sessionStorage.setItem(REVEAL_KEY, JSON.stringify(all));
    } catch {
      // Storage blocked: the reveal just won't survive a reload.
    }
    apply();
  }

  // --- State ----------------------------------------------------------------

  // Watch page: "pending" until we know whose video it is (fail closed),
  // then the protected channel or null.
  function watchedChannel(page) {
    if (page.kind === 'watch') {
      if (!settingsLoaded) return 'pending';
      if (!isOn()) return null;
      if (context.videoId !== page.videoId || !context.channelId) return 'pending';
    } else if (!isOn()) {
      return null;
    }
    // Off the watch page this still covers the miniplayer, which keeps the last video.
    return findById(context.channelId) || null;
  }

  function playerState(channel) {
    if (channel === 'pending') return 'pending';
    if (!channel || !option(channel, 'hideProgress')) return null;
    return isRevealed(context.videoId, 'player') ? 'revealed' : 'on';
  }

  function commentsState(page, channel) {
    if (page.kind !== 'watch' || !channel) return null;
    if (channel === 'pending') return 'hidden';
    if (!option(channel, 'hideComments')) return null;
    return isRevealed(context.videoId, 'comments') ? null : 'hidden';
  }

  function channelOfPage(page) {
    if (!isOn() || page.kind !== 'channel') return null;
    return findById(page.id) || findByHandle(page.handle) || findById(context.browseId) || null;
  }

  function setAttr(name, value) {
    if (value) {
      if (root.getAttribute(name) !== value) root.setAttribute(name, value);
    } else {
      root.removeAttribute(name);
    }
  }

  const playerMasked = () => ['on', 'pending'].includes(root.dataset.blueshieldPlayer);

  function apply() {
    const page = pageInfo();
    const watched = watchedChannel(page);
    const pageChannel = channelOfPage(page);
    setAttr('data-blueshield-player', playerState(watched));
    setAttr('data-blueshield-comments', commentsState(page, watched));
    setAttr('data-blueshield-thumbs', option(pageChannel, 'hideProgress') ? 'all' : null);
    setAttr('data-blueshield-blur', option(pageChannel, 'blurThumbs') ? 'all' : null);
    setAttr('data-blueshield-titles', option(pageChannel, 'blurTitles') ? 'all' : null);
    if (playerMasked()) leaveRemainingTimeMode();
    if (root.dataset.blueshieldPlayer) ensurePlayerControls();
    if (root.dataset.blueshieldComments) ensureCommentsPlaceholder();
    if (!playerMasked()) closeDialog();
  }

  // Icons come from shared/dom.js, built as SVG nodes: YouTube enforces Trusted Types on
  // innerHTML. .blueshield-icon sizes them against the player's own font size.
  const icon = (name) => svg(name, 'blueshield-icon');

  // --- Player controls: seek buttons + reveal ---------------------------------

  // null = small gap between the "back" and "forward" groups.
  const SEEK_STEPS = [
    { delta: -60, label: '−1 min', title: 'seekBack60' },
    { delta: -10, label: '−10 s', title: 'seekBack10', fine: true },
    null,
    { delta: 10, label: '+10 s', title: 'seekFwd10', fine: true },
    { delta: 60, label: '+1 min', title: 'seekFwd60' },
  ];

  function seekBy(delta) {
    const video = document.querySelector('#movie_player video');
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + delta));
  }

  function controlButton({ className = '', title, label, iconName, onClick }) {
    const button = el('button', { type: 'button', className, title });
    button.setAttribute('aria-label', title);
    if (iconName) button.append(icon(iconName));
    if (label) button.append(iconName ? el('span', { className: 'blueshield-label', textContent: label }) : label);
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // keep YouTube's own control handlers out of it
      onClick(e);
    });
    return button;
  }

  function ensurePlayerControls() {
    const wrapper = document.querySelector('#movie_player .ytp-time-wrapper');
    if (!wrapper || wrapper.querySelector('.blueshield-controls')) return;
    const seek = el('span', { className: 'blueshield-seek' });
    for (const step of SEEK_STEPS) {
      seek.append(step
        ? controlButton({ className: step.fine ? 'blueshield-fine' : '', title: t(step.title), label: step.label, onClick: () => seekBy(step.delta) })
        : el('span', { className: 'blueshield-gap' }));
    }
    // An eye alone didn't say what it does: the buttons carry a short label, set apart from the seek group.
    wrapper.append(el('span', { className: 'blueshield-controls' }, [
      seek,
      el('span', { className: 'blueshield-toggle' }, [
        controlButton({ className: 'blueshield-reveal', title: t('showDuration'), label: t('showDurationShort'), iconName: 'eye', onClick: openDialog }),
        controlButton({ className: 'blueshield-rehide', title: t('hideDuration'), label: t('hideDurationShort'), iconName: 'eyeOff', onClick: () => setRevealed('player', false) }),
      ]),
    ]));
  }

  // --- Reveal confirmation, drawn inside the player so it works in fullscreen ---

  let dialog = null;
  let returnFocus = null;

  function openDialog() {
    const player = document.getElementById('movie_player');
    if (!player || dialog) return;
    returnFocus = document.activeElement;
    const cancel = el('button', { type: 'button', className: 'blueshield-btn', textContent: t('keepHidden') });
    const confirm = el('button', { type: 'button', className: 'blueshield-btn blueshield-btn-primary', textContent: t('show') });
    const box = el('div', { className: 'blueshield-dialog' }, [
      el('span', { className: 'blueshield-dialog-icon' }, [icon('eye')]),
      el('h2', { id: 'blueshield-dialog-title', textContent: t('dialogTitle') }),
      el('p', {
        id: 'blueshield-dialog-desc',
        textContent: t('dialogText'),
      }),
      el('div', { className: 'blueshield-dialog-actions' }, [cancel, confirm]),
    ]);
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'blueshield-dialog-title');
    box.setAttribute('aria-describedby', 'blueshield-dialog-desc');
    dialog = el('div', { className: 'blueshield-backdrop' }, [box]);

    // Nothing inside may reach YouTube's handlers (click = play/pause, double-click = fullscreen).
    for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'mouseup', 'keyup']) {
      dialog.addEventListener(type, (e) => e.stopPropagation());
    }
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });
    cancel.addEventListener('click', closeDialog);
    confirm.addEventListener('click', () => {
      closeDialog();
      setRevealed('player', true);
    });

    player.append(dialog);
    requestAnimationFrame(() => dialog?.classList.add('is-open'));
    cancel.focus(); // the safe choice is the default one
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.remove();
    dialog = null;
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function onDialogKey(e) {
    if (e.key === 'Escape') {
      closeDialog();
    } else if (e.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      const next = buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      next.focus();
      e.preventDefault();
    }
    // Stop YouTube's shortcuts (space = pause, f = fullscreen…) but keep the
    // browser's default so Enter / Space still press the focused button.
    e.stopImmediatePropagation();
  }

  // --- Comments placeholder --------------------------------------------------

  function ensureCommentsPlaceholder() {
    const comments = document.querySelector('ytd-watch-flexy ytd-comments#comments');
    if (!comments) return;
    let card = document.getElementById('blueshield-comments');
    if (card && card.nextElementSibling === comments) return;
    if (!card) {
      const show = el('button', { type: 'button', className: 'blueshield-comments-show', textContent: t('showComments') });
      show.addEventListener('click', () => setRevealed('comments', true));
      card = el('div', { id: 'blueshield-comments' }, [
        el('span', { className: 'blueshield-comments-icon' }, [icon('commentOff')]),
        el('div', { className: 'blueshield-comments-text' }, [
          el('strong', { textContent: t('commentsHidden') }),
        ]),
        show,
      ]);
    }
    comments.before(card);
  }

  // --- Thumbnails of protected channels anywhere on YouTube -----------------

  const quote = (s) => `"${s.replace(/["\\]/g, '\\$&')}"`;
  const linksTo = (c) => [
    `a[href=${quote(`/channel/${c.id}`)}]`,
    `a[href^=${quote(`/channel/${c.id}/`)}]`,
    ...(c.handle ? [`a[href=${quote(`/${c.handle}`)} i]`, `a[href^=${quote(`/${c.handle}/`)} i]`] : []),
  ];

  // What each per-channel option does to a video card. `key` is an option from
  // shared/options.js; `attr` marks cards matched by channel name (scanCards); `page` is the
  // <html> attribute set on the channel's own page. An option with no entry here acts elsewhere
  // (hideComments) — it just needs no card CSS.
  const CARD_FEATURES = [
    {
      key: 'hideProgress',
      attr: 'data-blueshield-hide',
      page: 'html[data-blueshield-thumbs="all"]',
      css: (scope) => `${scope} :is(${BADGES}) { display: none !important; }`,
    },
    {
      key: 'blurThumbs',
      attr: 'data-blueshield-blur',
      page: 'html[data-blueshield-blur="all"]',
      css: (scope) => `
        ${scope} :is(${THUMBS}) { overflow: hidden !important; position: relative; }
        ${scope} :is(${THUMBS}) img { filter: blur(22px) saturate(.6) brightness(.85) !important; transform: scale(1.2); }
        ${scope} :is(${THUMBS})::after {
          content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: center / 34px no-repeat url("${BLUR_BADGE}");
        }`,
    },
    {
      key: 'blurTitles',
      attr: 'data-blueshield-blur-title',
      page: 'html[data-blueshield-titles="all"]',
      // Readable after a deliberate 0.6 s hover, so you can still find the video you want.
      // Reduced motion drops the fade but keeps the delay: it guards against an accidental
      // reveal, it isn't decoration.
      css: (scope) => `
        ${scope} :is(${TITLES}) { filter: blur(6px); transition: filter .15s; }
        ${scope} :is(${TITLES}):hover { filter: none; transition: filter .25s .6s; }
        @media (prefers-reduced-motion: reduce) {
          ${scope} :is(${TITLES}) { transition: filter 0s; }
          ${scope} :is(${TITLES}):hover { transition: filter 0s .6s; }
        }`,
    },
  ];
  const CARD_ATTRS = CARD_FEATURES.map((f) => `[${f.attr}]`).join(',');

  function updateCardStyle() {
    let style = document.getElementById('blueshield-cards');
    if (!style) {
      style = el('style', { id: 'blueshield-cards' });
      (document.head || root).appendChild(style);
    }
    if (!isOn()) {
      style.textContent = '';
      return;
    }
    style.textContent = CARD_FEATURES.map(({ key, attr, page, css }) => {
      const links = settings.channels.filter((c) => option(c, key)).flatMap(linksTo);
      const cards = `:is(${CARDS}):is(${links.length ? `:has(${links.join(',')}), ` : ''}[${attr}])`;
      return `${css(cards)}\n${css(`${page} :is(${PAGE_CARDS})`)}`;
    }).join('\n');
  }

  // Some cards (sidebar, playlists) only show the channel name as plain text.
  let scanTimer = 0;
  function scheduleScan() {
    if (!scanTimer) scanTimer = setTimeout(scanCards, 400);
  }
  function scanCards() {
    scanTimer = 0;
    const named = isOn() ? settings.channels.filter((c) => c.title) : [];
    const cards = document.querySelectorAll(named.length ? CARDS : CARD_ATTRS);
    for (const card of cards) {
      // YouTube recycles cards for other videos, so recompute every time.
      const text = card.textContent;
      const match = named.find((c) => text.includes(c.title));
      for (const { key, attr } of CARD_FEATURES) card.toggleAttribute(attr, option(match, key));
    }
  }

  // --- Leaks through controls ----------------------------------------------

  // Clicking the timer switches to "remaining time" (-1:08:12), which gives the duration away.
  let bypassTimeToggle = false;
  function leaveRemainingTimeMode() {
    const current = document.querySelector('#movie_player .ytp-time-current');
    if (!current?.textContent.trim().startsWith('-')) return;
    bypassTimeToggle = true;
    current.closest('.ytp-time-contents')?.click();
    bypassTimeToggle = false;
  }

  const isTyping = (t) => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName);
  const block = (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  window.addEventListener('click', (e) => {
    if (!bypassTimeToggle && playerMasked() && e.target.closest?.('.ytp-time-contents')) block(e);
  }, true);

  window.addEventListener('keydown', (e) => {
    if (dialog) return onDialogKey(e);
    if (!playerMasked() || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
    // 0-9 jump to 0 %…90 %: the timer would then reveal the total length.
    if (/^(Digit|Numpad)\d$/.test(e.code)) return block(e);
    const inPlayer = e.target.closest?.('.html5-video-player');
    if (inPlayer && (e.key === 'Home' || e.key === 'End')) return block(e);
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.ytp-time-contents')) return block(e);
  }, true);

  // --- Wiring --------------------------------------------------------------

  document.addEventListener('blueshield:context', (e) => {
    try {
      context = JSON.parse(e.detail);
    } catch {
      return;
    }
    apply();
  });
  document.dispatchEvent(new CustomEvent('blueshield:request'));

  for (const type of ['yt-navigate-start', 'yt-navigate-finish', 'popstate']) {
    window.addEventListener(type, apply, true);
  }
  setInterval(apply, 500); // catches URL changes YouTube makes without events

  new MutationObserver(scheduleScan).observe(root, { childList: true, subtree: true, characterData: true });

  function onSettings(next) {
    const languageChanged = settingsLoaded && next.language !== settings.language;
    settings = { ...DEFAULTS, ...next };
    settingsLoaded = true;
    if (languageChanged) {
      // Our controls are built once; drop them so apply() rebuilds them in the new language.
      closeDialog();
      document.querySelector('#movie_player .blueshield-controls')?.remove();
      document.getElementById('blueshield-comments')?.remove();
    }
    updateCardStyle();
    apply();
    scanCards();
  }

  apply();
  chrome.storage.sync.get(DEFAULTS).then(onSettings);
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') chrome.storage.sync.get(DEFAULTS).then(onSettings);
  });

  // Popup asks: "which channel is this tab showing?"
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type !== 'blueshield:get-context') return;
    const page = pageInfo();
    let channel = null;
    if (page.kind === 'watch' && context.videoId === page.videoId && context.channelId) {
      const ownerHref = document.querySelector('ytd-watch-metadata #owner a[href^="/@"]')?.getAttribute('href');
      channel = {
        id: context.channelId,
        title: context.author,
        handle: ownerHref ? decodeURIComponent(ownerHref.slice(1).split('/')[0]) : null,
      };
    } else if (page.kind === 'channel' && context.browseId) {
      channel = {
        id: context.browseId,
        title: context.browseTitle,
        handle: context.browseHandle ? decodeURIComponent(context.browseHandle) : null,
        avatar: context.browseAvatar,
      };
    }
    reply(channel);
  });
})();
