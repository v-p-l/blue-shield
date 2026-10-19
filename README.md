# Blue Shield

Anti-spoiler Chrome extension for YouTube: on the channels you choose, the progress bar disappears
and so does the total duration. Only the elapsed time remains, with seek buttons.

## Install (2 minutes)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (`blue-shield`).
4. Pin the Blue Shield icon to the toolbar.
5. Reload the YouTube tabs that are already open.

On first install, the list starts with one sample channel, Karmine Corp Replay, so the options can
be tried on a real channel. Remove it from the popup if you don't need it.

## Add a channel

- On a video or a channel page: popup → **Add**.
- Or paste into the popup: `https://www.youtube.com/@KarmineCorpVOD`, `@KarmineCorpVOD`,
  a `UC…` ID, or a link to one of the channel's videos.

## What is hidden

Each channel has 4 switches in the popup, in two groups: **Video page** (duration, comments) and
**Video lists** (thumbnails, titles).

| Leak | Handling |
|---|---|
| Progress bar, hover preview, heatmap | hidden |
| Total duration in the timer | removed, only the elapsed time remains (`1:24:37`) |
| Seeking in the video | `−1 min` `−10 s` `+10 s` `+1 min` buttons right of the timer |
| "Time remaining" mode (click on the timer) | blocked |
| Keys `0`–`9` (jump to X %), `Home`, `End` | blocked (`←` `→` `J` `L` still work) |
| Chapters (player + description) | hidden |
| Duration badge and "watched" bar on thumbnails | hidden (channel page, search, home, suggestions) |
| Windows / Chrome media controls | fake 9:59:59 duration |
| Comments and live chat replay | replaced by "Comments hidden" + a Show button *(per-channel option)* |
| Titles of the channel's videos | blurred, readable after hovering 0.6 s *(per-channel option, off by default)* |
| Thumbnails of the channel (e.g. "GAME 02") | blurred, duration hidden *(per-channel option, off by default)* |

## Show the duration

Eye button right of the seek buttons → confirm → the bar and the duration come back for this video
only (until the tab is closed). The crossed-out eye hides them again without confirmation.

Full screen, theater mode and the miniplayer use the same player: they are covered.
The duration of **ads** stays visible.

Until the video's channel is identified, everything is hidden (fail-closed).

## Settings

Gear icon right of the popup's switch:

- **Theme**: dark (default) or light. It applies to the popup.
- **Language**: French or English. It applies to the popup and the player buttons.
  With no saved choice, it follows the browser's language.

## Smoke test

```
node tools/smoke.mjs
```

Opens a throwaway Chrome (temporary profile: your channels and cookies are not touched), loads the
extension into it and checks on the real YouTube that the bar, the duration, the thumbnail badges
and the `0`–`9` keys are neutralized, with the counter-test on a channel that is not listed. Allow
5 minutes: signed out, YouTube serves up to 3 minutes of ads before the video. Add `--headless` to
run it without a window. Exits non-zero if a check fails.

## Files

- `content/main-world.js`: reads the channel ID from YouTube's internal data, fakes the Media Session.
- `content/content.js`: decides what to hide, sets `data-blueshield-*` on `<html>`, blocks the keys.
- `content/blueshield.css`: the hiding itself, driven by those attributes.
- `popup/`: channel management and settings (`chrome.storage.sync`).
- `welcome/`: page opened on install (pin the icon, pick channels from the YouTube subscriptions).
  `background.js` opens it, after adding the sample channel.
- `shared/`: everything used by more than one surface. The three files loaded as classic scripts
  (a content script can't be a module) expose a global object:
  - `i18n.js`: the French and English strings → `blueshieldI18n`.
  - `options.js`: the per-channel options, their defaults and the sample channel → `blueshieldOptions`.
    **It is the single source**: adding an option starts here.
  - `dom.js`: `el()`, `svg()` and the icon set → `blueshieldDom`.
- `shared/ui.js` (module): the avatar, the status line, the subscription picker, applying strings /
  theme / focus. `shared/ui.css`: the shared tokens and components.
  `shared/channels.js`: resolving a channel from a link, reading the subscriptions.
  `shared/theme.js` sets the theme before first paint.
- `design/icons/build.mjs`: generates the icons in `icons/`.
- `tools/smoke.mjs`: the smoke test above; `tools/cdp.mjs`: its DevTools client, no dependency.
- `tools/build-zip.mjs`: the zip to upload to the Chrome Web Store (`dist/`). `store/`: the
  listing texts.
