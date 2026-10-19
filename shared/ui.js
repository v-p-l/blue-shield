// DOM pieces shared by the popup and the welcome page: the avatar, the status line, the
// subscriptions picker, and the i18n / theme / focus plumbing both pages need.
// Styles: shared/ui.css. ES module — the content script shares shared/dom.js instead.
import { nameOf } from './channels.js';

const { el, svg } = globalThis.blueshieldDom;

// --- Avatar ------------------------------------------------------------------

// Fills an existing .avatar: the channel's picture, or the first letter of its name.
export function fillAvatar(node, channel) {
  node.replaceChildren(channel.avatar
    ? el('img', { src: channel.avatar, alt: '' })
    : nameOf(channel).trim().charAt(0).toUpperCase());
  return node;
}

export const avatar = (channel) => fillAvatar(el('span', { className: 'avatar' }), channel);

// --- Status line -------------------------------------------------------------

// Transient feedback under a field. '' clears it (.status:empty is hidden).
export function setStatus(node, text, kind = '') {
  node.textContent = text;
  node.className = `status${kind ? ` is-${kind}` : ''}`;
}

// --- i18n and theme ----------------------------------------------------------

// Static text in the HTML carries data-i18n (text content), data-i18n-placeholder, -title
// and -aria-label. Each page handles its own extras (<title>, rich sentences).
export function applyStaticStrings(t) {
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const [attr, prop] of [['placeholder', 'i18nPlaceholder'], ['title', 'i18nTitle'], ['aria-label', 'i18nAriaLabel']]) {
    for (const node of document.querySelectorAll(`[data-i18n-${attr}]`)) node.setAttribute(attr, t(node.dataset[prop]));
  }
}

// Mirrored into localStorage: shared/theme.js reads it before the next first paint.
export function applyTheme(theme = 'dark') {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('blueshield:theme', theme);
  } catch {
    // Storage blocked: the page may flash the default theme when it opens.
  }
}

// --- Focus ------------------------------------------------------------------

// The lists are rebuilt on every change: keep keyboard focus on the same control.
// Controls that survive a rebuild carry a data-focus-key.
export function keepFocus(rebuild) {
  const key = document.activeElement?.dataset?.focusKey;
  rebuild();
  if (key) document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
}

// --- Subscriptions picker ----------------------------------------------------

// Grey placeholder rows while the subscriptions load: same height as real rows, so nothing jumps.
export function pickerSkeleton(count = 6) {
  return Array.from({ length: count }, () => {
    const row = el('li', { className: 'picker-row is-skeleton' }, [
      el('span', { className: 'avatar' }),
      el('span', { className: 'picker-name' }, [el('span', { className: 'skeleton-bar' })]),
      el('span', { className: 'btn btn-secondary' }),
    ]);
    row.setAttribute('aria-hidden', 'true');
    return row;
  });
}

// listedIds: IDs already in the list. onToggle(channel, add) does the storage write.
export function pickerRows(channels, listedIds, { t, onToggle }) {
  return channels.map((channel) => {
    const added = listedIds.has(channel.id);
    const button = el('button', {
      type: 'button',
      className: `btn ${added ? 'btn-added' : 'btn-secondary'}`,
    }, added ? [svg('check'), t('added')] : [t('add')]);
    button.setAttribute('aria-pressed', String(added));
    button.setAttribute('aria-label', nameOf(channel)); // a toggle: the name plus its pressed state
    button.dataset.focusKey = `pick:${channel.id}`;
    button.addEventListener('click', () => onToggle(channel, !added));
    return el('li', { className: 'picker-row' }, [
      avatar(channel),
      el('span', { className: 'picker-name', textContent: nameOf(channel) }),
      button,
    ]);
  });
}
