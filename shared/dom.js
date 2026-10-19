// DOM helpers and the icon set, shared by the popup, the welcome page and the content script.
// Classic script, like shared/i18n.js: content scripts can't be ES modules, so it exposes
// globalThis.blueshieldDom. The whole set ships to every YouTube page (a few KB) in exchange for
// one place to change an icon.
(() => {
  'use strict';

  // Lucide-style icons: 24px grid, stroked, no fill. The stroke properties come from the CSS
  // (svg {} in shared/ui.css, .blueshield-icon in content/blueshield.css).
  const ICONS = {
    plus: ['M5 12h14', 'M12 5v14'],
    check: ['M20 6 9 17l-5-5'],
    chevron: ['m6 9 6 6 6-6'],
    chevronLeft: ['m15 18-6-6 6-6'],
    moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
    sun: [
      'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41',
      'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41',
    ],
    settings: [
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    ],
    external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
    link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    timerOff: ['M10 2h4', 'M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7', 'M7.4 7.4a8 8 0 0 1 10.3 1 8 8 0 0 1 .9 10.2', 'm2 2 20 20', 'M12 12v-2'],
    titleOff: ['M4 7V4h16v3', 'M5 20h6', 'M13 4 8 20', 'm15 15 5 5', 'm20 15-5 5'],
    commentOff: ['M21 15V5a2 2 0 0 0-2-2H9', 'm2 2 20 20', 'M3.6 3.6c-.4.3-.6.8-.6 1.4v16l4-4h10'],
    imageOff: [
      'm2 2 20 20',
      'M10.41 10.41a2 2 0 1 1-2.83-2.83',
      'M13.5 13.5 6 21',
      'M18 12l3 3',
      'M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59',
      'M21 15V5a2 2 0 0 0-2-2H9',
    ],
    eye: ['M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
    eyeOff: [
      'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
      'M14.084 14.158a3 3 0 0 1-4.242-4.242',
      'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
      'm2 2 20 20',
    ],
    puzzle: ['M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z'],
    pin: ['M12 17v5', 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z'],
  };

  const NS = 'http://www.w3.org/2000/svg';

  // Built as SVG nodes, never from innerHTML: YouTube enforces Trusted Types on the pages the
  // content script injects into.
  function svg(name, className) {
    const node = document.createElementNS(NS, 'svg');
    node.setAttribute('viewBox', '0 0 24 24');
    node.setAttribute('aria-hidden', 'true');
    if (className) node.setAttribute('class', className);
    for (const d of ICONS[name]) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      node.append(path);
    }
    return node;
  }

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  // Every <span data-icon="name"> in the HTML gets its icon.
  const fillIcons = (root = document) => {
    for (const node of root.querySelectorAll('[data-icon]')) node.append(svg(node.dataset.icon));
  };

  globalThis.blueshieldDom = { ICONS, svg, el, fillIcons };
})();
