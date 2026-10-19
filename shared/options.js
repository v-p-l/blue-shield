// The per-channel anti-spoil options: one list, read by the popup (to draw the switches) and by
// the content script (to decide what to mask). Classic script, like shared/i18n.js: content
// scripts can't be ES modules, so it exposes globalThis.blueshieldOptions.
//
// Adding an option: add it here, add its two labels to shared/i18n.js, and — if it acts on video
// cards — add its CSS to CARD_FEATURES in content/content.js, keyed by the same `key`.
(() => {
  'use strict';

  // Grouped by where they act: the watch page vs every list of videos. `title` and `label` are
  // shared/i18n.js keys, `icon` a shared/dom.js icon name.
  const GROUPS = [
    {
      title: 'groupWatch',
      options: [
        { key: 'hideProgress', default: true, icon: 'timerOff', label: 'optDuration' },
        { key: 'hideComments', default: true, icon: 'commentOff', label: 'optComments' },
      ],
    },
    {
      title: 'groupLists',
      options: [
        { key: 'blurThumbs', default: false, icon: 'imageOff', label: 'optThumbs' },
        { key: 'blurTitles', default: false, icon: 'titleOff', label: 'optTitles' },
      ],
    },
  ];

  const ALL = GROUPS.flatMap((group) => group.options);
  const DEFAULTS = Object.fromEntries(ALL.map((o) => [o.key, o.default]));

  // Channels saved before an option existed, and no channel at all, fall back to the default.
  const get = (channel, key) => !!channel && (channel[key] ?? DEFAULTS[key]);

  // The entry stored for a channel being added. The defaults are written out rather than left
  // implicit, so changing one later doesn't silently change channels already in the list.
  const newEntry = (channel) => ({ ...DEFAULTS, ...channel, addedAt: Date.now() });

  // The channel added on first install, so a new user sees the options on a real channel.
  // Its videos last hours, which makes every hidden leak obvious.
  const STARTER = {
    id: 'UCApmTE4So9oX7sPkDGgSpFQ',
    title: 'Karmine Corp Replay',
    handle: '@KarmineCorpVOD',
    // Its picture on 2026-10-19: background.js reads the current one at install when it can.
    avatar: 'https://yt3.googleusercontent.com/898XXUyL1LcjDfp8LTdx7bvwIy8jIbPuNTljnXsdhKqNNecLPt4ULlzPjDWcprBf83wY9a9d5A=s176-c-k-c0x00ffffff-no-rj',
  };

  globalThis.blueshieldOptions = { GROUPS, ALL, DEFAULTS, get, newEntry, STARTER };
})();
