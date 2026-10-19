// Blue Shield icon: a blue shield with a white eye crossed out (spoilers stay hidden).
//
// 128 keeps the 16 px margin the Chrome Web Store asks for; 16 to 48 fill the canvas, like the
// other toolbar icons. No outline: a white ring is invisible on a light toolbar and only made
// the shield look smaller.
// 24 to 128 scale one vector drawing. 16 is drawn pixel by pixel: at that size a scaled
// eye turns into grey mush.
//
// Run: ICON_DEPS=<folder with @resvg/resvg-js in node_modules> node build.mjs
// The dependencies live outside the extension folder: Chrome refuses to load an unpacked
// extension that contains node_modules files starting with "_".

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.env.ICON_DEPS || here, 'package.json'));
const { Resvg } = require('@resvg/resvg-js');

const BLUE = '#0574b0'; // --accent, light theme, popup/popup.css
const WHITE = '#ffffff';

// Shield box per size: x0..x1 vertical sides, y0 top point, y1 bottom point.
const SHIELDS = {
  128: [23, 105, 16, 112],
  48: [4, 44, 1, 47],
  32: [2, 30, 0, 32],
  24: [2, 22, 0, 24],
  16: [1, 15, 0, 16],
};

// Shield shape as fractions of its height. Shoulders and the start of the curve sit on whole
// pixels.
function shieldPath([x0, x1, y0, y1]) {
  const H = y1 - y0, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  const shoulder = Math.round(y0 + 0.138 * H), curve = Math.round(y0 + 0.447 * H);
  const k1 = curve + 0.5 * (y1 - curve), k2 = curve + 0.808 * (y1 - curve);
  const f = (v) => +v.toFixed(2);
  return `M${f(cx)} ${y0} L${x1} ${shoulder} V${curve} C${x1} ${f(k1)} ${f(cx + 0.575 * hw)} ${f(k2)} ${f(cx)} ${y1}`
    + ` C${f(cx - 0.575 * hw)} ${f(k2)} ${x0} ${f(k1)} ${x0} ${curve} V${shoulder} Z`;
}

// Eye on a 128 x 128 shield-sized grid (axis at x = 64), scaled into each shield.
// The slash runs through the pupil; a blue gap on each side cuts the eye.
const EYE = { cx: 64, cy: 62, hw: 46, hh: 30, w: 10, pupil: 18 };
const SLASH = { x1: 28, y1: 26, x2: 100, y2: 98, w: 10, gap: 5 };
function eye() {
  const { cx, cy, hw, hh, w, pupil } = EYE, s = SLASH;
  const line = (stroke, width) =>
    `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
  // Outline of the eye: two cubic arcs (hh is the half-height at the middle), and a solid pupil.
  const k = (4 / 3) * hh, a = 0.45 * hw;
  const lid = `M${cx - hw} ${cy} C${cx - a} ${cy - k} ${cx + a} ${cy - k} ${cx + hw} ${cy} C${cx + a} ${cy + k} ${cx - a} ${cy + k} ${cx - hw} ${cy} Z`;
  return [
    `<path d="${lid}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linejoin="round"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${pupil}" fill="${WHITE}"/>`,
    line(BLUE, s.w + 2 * s.gap),
    line(WHITE, s.w),
  ].join('\n');
}

// 16 px, one character per pixel: W white, b blue (the gap around the slash), . shield as is.
const PIXELS_16 = [
  '................',
  '................',
  '...b............',
  '...Wb...........',
  '...bWbWWWW......',
  '....bWb...WW....',
  '...W.bWWW...W...',
  '..W...WWWW...W..',
  '..W...WWWW...W..',
  '...W...WWWb.W...',
  '....WW...bWb....',
  '......WWWWbWb...',
  '...........bW...',
  '............b...',
  '................',
  '................',
];

function svg(n) {
  const shield = SHIELDS[n];
  const clip = `<clipPath id="s"><path d="${shieldPath(shield)}"/></clipPath>`;
  let content;
  if (n === 16) {
    const rects = [];
    PIXELS_16.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== '.') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'W' ? WHITE : BLUE}"/>`);
    }));
    content = `<g shape-rendering="crispEdges">${rects.join('')}</g>`;
  } else {
    const [x0, x1, y0, y1] = shield;
    const k = (y1 - y0) / 128;
    content = `<g transform="translate(${(x0 + x1) / 2 - 64 * k} ${y0}) scale(${k})">${eye()}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}">
<title>Blue Shield</title>
<defs>${clip}</defs>
<path d="${shieldPath(shield)}" fill="${BLUE}"/>
<g clip-path="url(#s)">${content}</g>
</svg>
`;
}

const render = (src) => new Resvg(src, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } }).render();

const outDir = process.env.OUT_DIR || path.join(here, '..', '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const n of Object.keys(SHIELDS).map(Number)) {
  const src = svg(n);
  if (n === 128) fs.writeFileSync(path.join(outDir, 'icon.svg'), src);
  // logo.svg: the shield filling its canvas, for the popup header.
  if (n === 48) fs.writeFileSync(path.join(outDir, 'logo.svg'), src);
  fs.writeFileSync(path.join(outDir, `icon-${n}.png`), render(src).asPng());
}
console.log('ok', outDir);
