import { YT, nameOf, matchesQuery, resolveChannel, fetchChannel, fetchSubscriptions } from '../shared/channels.js';
import {
  applyStaticStrings, applyTheme, avatar, fillAvatar, keepFocus, pickerRows, pickerSkeleton,
  setStatus as writeStatus,
} from '../shared/ui.js';

// Classic scripts loaded before this module (see popup.html).
const { el, svg, fillIcons } = globalThis.blueshieldDom;
const { LANGUAGES, resolve: resolveLanguage, t: translate } = globalThis.blueshieldI18n;
const OPTIONS = globalThis.blueshieldOptions;

// language: null = follow the browser (see shared/i18n.js).
const DEFAULTS = { enabled: true, channels: [], theme: 'dark', language: null };

// Below this many channels the whole list fits at a glance: no search field.
const SEARCH_FROM = 5;

const $ = (id) => document.getElementById(id);
const els = {
  enabled: $('enabled'),
  masterLabel: $('master-label'),
  current: $('current'),
  currentAvatar: $('current-avatar'),
  currentTitle: $('current-title'),
  currentAdd: $('current-add'),
  addChoices: $('add-choices'),
  linkOpen: $('link-open'),
  linkClose: $('link-close'),
  form: $('add-form'),
  input: $('add-input'),
  submit: $('add-submit'),
  status: $('status'),
  list: $('list'),
  count: $('count'),
  search: $('search'),
  empty: $('empty'),
  noMatch: $('no-match'),
  toast: $('toast'),
  toastText: $('toast-text'),
  toastUndo: $('toast-undo'),
  main: $('main'),
  settingsView: $('settings'),
  settingsOpen: $('settings-open'),
  settingsBack: $('settings-back'),
  languageOptions: $('language-options'),
  subsOpen: $('subs-open'),
  subsView: $('subs'),
  subsBack: $('subs-back'),
  subsSearch: $('subs-search'),
  subsStatus: $('subs-status'),
  subsList: $('subs-list'),
  subsNoMatch: $('subs-no-match'),
};

let settings = DEFAULTS;
const t = (key, vars) => translate(settings.language, key, vars);
const setStatus = (text, kind) => writeStatus(els.status, text, kind);
let currentChannel = null;
// Channels are collapsed by default; these are open (this popup session only).
const openIds = new Set();

// --- Storage -----------------------------------------------------------------

async function loadSettings() {
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

// Read the list again before each write: the welcome page may have changed it since the popup
// opened. `transform` returns the new list, or the one it was given to write nothing.
async function updateChannels(transform) {
  const { channels = [] } = await chrome.storage.sync.get('channels');
  const next = transform(channels);
  if (next === channels) return;
  settings = { ...settings, channels: next };
  render();
  await chrome.storage.sync.set({ channels: next });
}

async function addChannel(channel) {
  let already = false;
  await updateChannels((channels) => {
    already = channels.some((c) => c.id === channel.id);
    if (already) return channels;
    openIds.add(channel.id); // show the options of the channel just added
    return [OPTIONS.newEntry(channel), ...channels];
  });
  if (already) setStatus(t('alreadyListed', { name: nameOf(channel) }), 'ok');
  else setStatus(''); // the new channel at the top of the list is the confirmation
}

function updateChannel(id, patch) {
  updateChannels((channels) => channels.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

function removeChannel(channel) {
  let index = 0; // where to put it back if the user undoes
  updateChannels((channels) => {
    index = Math.max(0, channels.findIndex((c) => c.id === channel.id));
    return channels.filter((c) => c.id !== channel.id);
  });
  setStatus('');
  showToast(t('deleted', { name: nameOf(channel) }), () => updateChannels((channels) => {
    const next = [...channels];
    next.splice(index, 0, channel);
    return next;
  }));
}

// --- Current tab ---------------------------------------------------------------

const stripEmpty = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

async function detectCurrentChannel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith(YT)) return;
  try {
    currentChannel = await chrome.tabs.sendMessage(tab.id, { type: 'blueshield:get-context' });
  } catch {
    currentChannel = null; // tab opened before the extension was installed: needs a reload
  }
  // The channel you are watching is the one you are most likely to adjust.
  if (currentChannel) openIds.add(currentChannel.id);
  render();
  // The content script knows the ID and name; fetch the avatar and handle for display.
  if (currentChannel && (!currentChannel.avatar || !currentChannel.handle)) {
    try {
      const full = await fetchChannel(currentChannel.id);
      if (full) currentChannel = { ...full, ...stripEmpty(currentChannel) };
      render();
    } catch {
      // Display only: keep what we have.
    }
  }
}

// --- Rendering -------------------------------------------------------------------

let toastTimer = 0;
function showToast(text, onUndo) {
  clearTimeout(toastTimer);
  els.toastText.textContent = text;
  els.toast.hidden = false;
  els.toastUndo.onclick = () => {
    els.toast.hidden = true;
    onUndo();
  };
  toastTimer = setTimeout(() => (els.toast.hidden = true), 6000);
}

function channelItem(channel) {
  const isCurrent = channel.id === currentChannel?.id;
  const isOpen = openIds.has(channel.id);
  const pic = avatar(channel);
  pic.setAttribute('aria-hidden', 'true'); // the name already labels the button

  // The name shrinks with an ellipsis; the "Cet onglet" tag never does.
  const title = el('span', { className: 'channel-title' }, [el('strong', { textContent: nameOf(channel) })]);
  if (isCurrent) title.append(el('span', { className: 'tag', textContent: t('thisTab') }));
  const meta = el('span', { className: 'channel-meta' }, [
    title,
    el('span', { className: 'channel-handle', textContent: channel.handle || channel.id }),
  ]);

  const optsId = `opts-${channel.id}`;
  const toggle = el('button', { type: 'button', className: 'channel-toggle' }, [pic, meta, svg('chevron')]);
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-controls', optsId);
  toggle.dataset.focusKey = `${channel.id}:toggle`;
  toggle.addEventListener('click', () => {
    if (isOpen) openIds.delete(channel.id);
    else openIds.add(channel.id);
    render();
  });

  // Secondary actions live inside the open panel, so the closed row keeps room for the name.
  const link = el('a', {
    className: 'link-btn',
    href: channel.handle ? `${YT}/${channel.handle}` : `${YT}/channel/${channel.id}`,
    target: '_blank',
  }, [svg('external'), t('open')]);
  link.setAttribute('aria-label', t('openLabel', { name: nameOf(channel) }));
  const remove = el('button', { type: 'button', className: 'link-btn link-btn-danger' }, [svg('trash'), t('delete')]);
  remove.setAttribute('aria-label', t('deleteLabel', { name: nameOf(channel) }));
  remove.addEventListener('click', () => removeChannel(channel));

  const opts = el('div', { className: 'opts', id: optsId, hidden: !isOpen }, OPTIONS.GROUPS.map(({ title: group, options }) => {
    const heading = el('p', { className: 'opt-group-title', id: `group-${channel.id}-${options[0].key}`, textContent: t(group) });
    const node = el('div', { className: 'opt-group' }, [heading, ...options.map(({ key, icon, label }) => {
      const input = el('input', { type: 'checkbox', className: 'switch switch-sm', checked: OPTIONS.get(channel, key) });
      input.setAttribute('role', 'switch');
      input.dataset.focusKey = `${channel.id}:${key}`;
      input.addEventListener('change', () => updateChannel(channel.id, { [key]: input.checked }));
      return el('label', { className: 'opt' }, [svg(icon), el('span', { textContent: t(label) }), input]);
    })]);
    node.setAttribute('role', 'group');
    node.setAttribute('aria-labelledby', heading.id);
    return node;
  }));
  opts.append(el('div', { className: 'channel-actions' }, [link, remove]));

  return el('li', { className: `channel${isCurrent ? ' is-current' : ''}${isOpen ? ' is-open' : ''}` }, [
    el('div', { className: 'channel-row' }, [toggle]),
    opts,
  ]);
}

function render() {
  els.enabled.checked = settings.enabled;
  els.masterLabel.textContent = t(settings.enabled ? 'active' : 'paused');
  document.body.classList.toggle('is-paused', !settings.enabled);

  // The current tab's channel: a big "Ajouter" when it isn't in the list yet,
  // otherwise it is pinned at the top of the list.
  const currentIsListed = !!currentChannel && settings.channels.some((c) => c.id === currentChannel.id);
  els.current.hidden = !currentChannel || currentIsListed;
  if (currentChannel && !currentIsListed) {
    els.currentTitle.textContent = nameOf(currentChannel);
    fillAvatar(els.currentAvatar, currentChannel);
  }

  const total = settings.channels.length;
  els.count.textContent = total ? String(total) : '';
  els.empty.hidden = total > 0;
  els.search.hidden = total < SEARCH_FROM;
  if (els.search.hidden) els.search.value = '';

  const query = els.search.value;
  const channels = settings.channels
    .filter((c) => matchesQuery(c, query))
    .sort((a, b) => (b.id === currentChannel?.id) - (a.id === currentChannel?.id));
  els.noMatch.hidden = !query.trim() || channels.length > 0;

  keepFocus(() => els.list.replaceChildren(...channels.map(channelItem)));
  renderSubs();
}

// --- Subscriptions view ------------------------------------------------------------

let subscriptions = null; // loaded the first time the view opens

function renderSubs() {
  if (els.subsView.hidden || !subscriptions) return;
  const query = els.subsSearch.value;
  const rows = subscriptions.filter((c) => matchesQuery(c, query));
  els.subsNoMatch.hidden = !query.trim() || rows.length > 0;
  const listedIds = new Set(settings.channels.map((c) => c.id));
  // Removing goes through removeChannel with the stored entry, so "Annuler" restores its options.
  const onToggle = (channel, add) => (add
    ? addChannel(channel)
    : removeChannel(settings.channels.find((c) => c.id === channel.id) || channel));
  keepFocus(() => els.subsList.replaceChildren(...pickerRows(rows, listedIds, { t, onToggle })));
}

async function loadSubscriptions() {
  writeStatus(els.subsStatus, '');
  els.subsList.setAttribute('aria-busy', 'true');
  els.subsList.replaceChildren(...pickerSkeleton());
  try {
    subscriptions = await fetchSubscriptions();
    writeStatus(els.subsStatus, subscriptions.length ? '' : t('subsSignedOut'));
  } catch (err) {
    subscriptions = null; // try again the next time the view opens
    writeStatus(els.subsStatus, t(err.i18nKey || 'errorNetwork'), 'error');
    els.subsList.replaceChildren();
  }
  els.subsList.removeAttribute('aria-busy');
  renderSubs();
}

// --- Events ----------------------------------------------------------------------

els.enabled.addEventListener('change', async () => {
  settings = { ...settings, enabled: els.enabled.checked };
  render();
  await chrome.storage.sync.set({ enabled: settings.enabled });
});

els.search.addEventListener('input', render);

els.currentAdd.addEventListener('click', () => currentChannel && addChannel(currentChannel));

// Two choices; "Depuis un lien" swaps them for the link field.
function showLinkForm(open) {
  els.form.hidden = !open;
  els.addChoices.hidden = open;
  els.linkOpen.setAttribute('aria-expanded', String(open));
  if (open) {
    els.input.focus();
  } else {
    els.input.value = '';
    setStatus('');
    els.linkOpen.focus();
  }
}

els.linkOpen.addEventListener('click', () => showLinkForm(true));
els.linkClose.addEventListener('click', () => showLinkForm(false));

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!els.input.value.trim()) {
    els.input.focus();
    return;
  }
  els.submit.disabled = true;
  setStatus(t('searching'));
  try {
    await addChannel(await resolveChannel(els.input.value));
    els.input.value = '';
  } catch (err) {
    setStatus(t(err.i18nKey || 'errorNetwork'), 'error');
  } finally {
    els.submit.disabled = false;
  }
});

// --- Settings: theme and language -------------------------------------------------

function renderSettings() {
  for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === settings.theme;
  const lang = resolveLanguage(settings.language);
  for (const input of els.languageOptions.querySelectorAll('input')) input.checked = input.value === lang;
}

function applyLanguage() {
  document.documentElement.lang = resolveLanguage(settings.language);
  applyStaticStrings(t);
}

async function saveSetting(patch) {
  settings = { ...settings, ...patch };
  applyTheme(settings.theme);
  applyLanguage();
  renderSettings();
  render();
  await chrome.storage.sync.set(patch);
}

// One view at a time: the channel list (null), 'settings' or 'subs'.
let opener = null; // the button that opened the current view gets focus back
function showView(name) {
  els.settingsView.hidden = name !== 'settings';
  els.subsView.hidden = name !== 'subs';
  els.main.hidden = !!name;
  els.settingsOpen.setAttribute('aria-expanded', String(name === 'settings'));
  els.settingsOpen.classList.toggle('is-active', name === 'settings');
  els.subsOpen.setAttribute('aria-expanded', String(name === 'subs'));
  if (name) {
    opener = name === 'settings' ? els.settingsOpen : els.subsOpen;
    (name === 'settings' ? els.settingsBack : els.subsBack).focus();
  } else {
    opener?.focus();
  }
}

// SVG files, not emoji: Windows has no flag emoji and shows the letters "FR" / "GB" instead.
const FLAGS = { fr: 'flags/fr.svg', en: 'flags/gb.svg' };
els.languageOptions.append(...LANGUAGES.map(({ code, name }) => el('label', {}, [
  el('input', { type: 'radio', name: 'language', value: code }),
  el('span', { className: 'choice', lang: code }, [el('img', { className: 'flag', src: FLAGS[code], alt: '' }), name]),
])));

els.settingsView.addEventListener('change', (e) => {
  if (e.target.name === 'theme') saveSetting({ theme: e.target.value });
  if (e.target.name === 'language') saveSetting({ language: e.target.value });
});
els.settingsOpen.addEventListener('click', () => showView(els.settingsView.hidden ? 'settings' : null));
els.settingsBack.addEventListener('click', () => showView(null));
els.subsOpen.addEventListener('click', () => {
  showView('subs');
  if (subscriptions) renderSubs();
  else loadSubscriptions();
});
els.subsBack.addEventListener('click', () => showView(null));
els.subsSearch.addEventListener('input', renderSubs);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Escape would otherwise close the whole popup.
  if (els.main.hidden) {
    e.preventDefault();
    showView(null);
  } else if (!els.form.hidden) {
    e.preventDefault();
    showLinkForm(false);
  }
});

// The welcome page writes to the same storage: follow it while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key in DEFAULTS) settings = { ...settings, [key]: newValue ?? DEFAULTS[key] };
  }
  if (changes.theme) applyTheme(settings.theme);
  if (changes.language) applyLanguage();
  renderSettings();
  render();
});

fillIcons();
$('version').textContent = `Blue Shield v${chrome.runtime.getManifest().version}`;

await loadSettings();
applyTheme(settings.theme);
applyLanguage();
renderSettings();
render();
detectCurrentChannel();
