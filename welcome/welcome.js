import { nameOf, matchesQuery, resolveChannel, fetchSubscriptions } from '../shared/channels.js';
import {
  applyStaticStrings, applyTheme, keepFocus, pickerRows, pickerSkeleton,
  setStatus as writeStatus,
} from '../shared/ui.js';

// Classic scripts loaded before this module (see welcome.html).
const { el, svg, fillIcons } = globalThis.blueshieldDom;
const { t: translate, resolve: resolveLanguage } = globalThis.blueshieldI18n;
const OPTIONS = globalThis.blueshieldOptions;

const $ = (id) => document.getElementById(id);
const els = {
  stepPin: $('step-pin'),
  pinText: $('pin-text'),
  pinDone: $('pin-done'),
  stepAdd: $('step-add'),
  stepLink: $('step-link'),
  linkChannels: $('link-channels'),
  search: $('search'),
  noMatch: $('no-match'),
  subsStatus: $('subs-status'),
  channels: $('channels'),
  form: $('add-form'),
  input: $('add-input'),
  submit: $('add-submit'),
  status: $('status'),
};

let settings = { language: null, theme: 'dark', channels: [] };
const t = (key, vars) => translate(settings.language, key, vars);
const setStatus = (text, kind) => writeStatus(els.status, text, kind);
let subscriptions = [];
let loading = true; // skeleton rows until the subscriptions arrive

// A translated sentence where {name} placeholders become DOM nodes (icons).
function richText(key, nodes) {
  const keep = Object.fromEntries(Object.keys(nodes).map((k) => [k, `{${k}}`]));
  return t(key, keep).split(/\{(\w+)\}/).map((part, i) => (i % 2 ? nodes[part]() : part));
}

// --- Step 1: pinned to the toolbar ------------------------------------------------

async function checkPinned() {
  if (!chrome.action.getUserSettings) return; // Chrome < 91: no way to know, the step stays open
  const { isOnToolbar } = await chrome.action.getUserSettings();
  els.stepPin.classList.toggle('is-done', isOnToolbar);
  els.pinDone.hidden = !isOnToolbar;
}

// --- Steps 2 and 3: channels ------------------------------------------------------

// Read the list again before each write: the popup may have changed it since this page opened.
async function setListed(channel, on) {
  const { channels = [] } = await chrome.storage.sync.get('channels');
  const others = channels.filter((c) => c.id !== channel.id);
  await chrome.storage.sync.set({
    channels: on ? [OPTIONS.newEntry(channel), ...others] : others,
  });
}

// Step 2 lists the subscriptions; step 3 lists the channels added by link (the listed ones that
// aren't subscriptions), under its field.
function render() {
  const listed = settings.channels || [];
  const listedIds = new Set(listed.map((c) => c.id));
  const subIds = new Set(subscriptions.map((c) => c.id));
  const byLink = listed.filter((c) => !subIds.has(c.id));
  const query = els.search.value;
  const subs = subscriptions.filter((c) => matchesQuery(c, query));
  els.noMatch.hidden = loading || !query.trim() || subs.length > 0;
  els.stepAdd.classList.toggle('is-done', listed.some((c) => subIds.has(c.id)));
  // The starter channel was added at install, not by the user: it doesn't complete the step.
  els.stepLink.classList.toggle('is-done', byLink.some((c) => c.id !== OPTIONS.STARTER.id));
  const options = { t, onToggle: setListed };
  keepFocus(() => {
    els.channels.replaceChildren(...pickerRows(subs, listedIds, options), ...(loading ? pickerSkeleton() : []));
    els.linkChannels.replaceChildren(...pickerRows(byLink, listedIds, options));
  });
}

async function loadSubscriptions() {
  try {
    subscriptions = await fetchSubscriptions();
    writeStatus(els.subsStatus, subscriptions.length ? '' : t('subsSignedOut'));
  } catch (err) {
    writeStatus(els.subsStatus, t(err.i18nKey || 'errorNetwork'), 'error');
  }
  loading = false;
  render();
}

els.search.addEventListener('input', render);

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!els.input.value.trim()) {
    els.input.focus();
    return;
  }
  els.submit.disabled = true;
  setStatus(t('searching'));
  try {
    const channel = await resolveChannel(els.input.value);
    if ((settings.channels || []).some((c) => c.id === channel.id)) setStatus(t('alreadyListed', { name: nameOf(channel) }), 'ok');
    else {
      await setListed(channel, true);
      setStatus('');
    }
    els.input.value = '';
  } catch (err) {
    setStatus(t(err.i18nKey || 'errorNetwork'), 'error');
  } finally {
    els.submit.disabled = false;
  }
});

// --- Setup ------------------------------------------------------------------------

function applyLanguage() {
  document.documentElement.lang = resolveLanguage(settings.language);
  document.title = t('welcomeTitle');
  applyStaticStrings(t);
  const icon = (name) => () => el('span', { className: 'inline-icon' }, [svg(name)]);
  els.pinText.replaceChildren(...richText('stepPinText', { puzzle: icon('puzzle'), pin: icon('pin') }));
}

fillIcons();

settings = { ...settings, ...(await chrome.storage.sync.get(['language', 'theme', 'channels'])) };
applyTheme(settings.theme);
applyLanguage();
render();
checkPinned();
loadSubscriptions();

// The popup writes to the same storage: follow it while this page is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [key, { newValue }] of Object.entries(changes)) settings = { ...settings, [key]: newValue };
  if (changes.theme) applyTheme(settings.theme);
  if (changes.language) applyLanguage();
  render();
});

// Pinning happens in Chrome's own menu: check again whenever it may have changed.
chrome.action.onUserSettingsChanged?.addListener(checkPinned);
window.addEventListener('focus', checkPinned);
