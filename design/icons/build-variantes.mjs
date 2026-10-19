// BlueShield icon generator: 3 variants, a detailed master (128 and 48) and pixel-fitted small
// versions (16, 24, 32). Everything is drawn on an integer grid so every joint is a whole pixel.
//
// Run: ICON_DEPS=<folder with opentype.js and @resvg/resvg-js in node_modules> node build.mjs
// The dependencies live outside the extension folder: Chrome refuses to load an unpacked
// extension that contains node_modules files starting with "_".

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.env.ICON_DEPS || here, 'package.json'));
const opentype = require('opentype.js');
const { Resvg } = require('@resvg/resvg-js');

export const BLUE = '#0574b0'; // --accent, light theme, popup/popup.css
export const WHITE = '#ffffff';
const OUT = path.join(here, 'out');

// ---------- B glyph ----------

const FONTS = {
  inter: { file: 'inter-latin-900-normal.woff', name: 'Inter Black (OFL)' },
  montserrat: { file: 'montserrat-latin-800-normal.woff', name: 'Montserrat ExtraBold (OFL)' },
  archivo: { file: 'archivo-black-latin-400-normal.woff', name: 'Archivo Black (OFL)' },
  // Bold cuts for 16 to 32 px: the heavy cuts close the counters of the B at 8 px.
  interBold: { file: 'inter-latin-700-normal.woff', name: 'Inter Bold (OFL)' },
  montserratBold: { file: 'montserrat-latin-700-normal.woff', name: 'Montserrat Bold (OFL)' },
  archivoBold: { file: 'archivo-latin-700-normal.woff', name: 'Archivo Bold (OFL)' },
};

function render(svg, opts = {}) {
  return new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false }, ...opts }).render();
}

export function glyphInfo(key) {
  const buf = fs.readFileSync(path.join(here, 'fonts', FONTS[key].file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const g = font.charToGlyph('B');
  const bb = g.getBoundingBox();
  const info = { key, name: FONTS[key].name, cmds: g.path.commands, bb, cap: bb.y2 };
  // Measure ink centroid and stem width on a big raster (cap height = 400 px).
  const s = 400 / info.cap;
  const d = pathD(info.cmds, (x, y) => [50 + (x - bb.x1) * s, 450 - y * s]);
  const img = render(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500"><path d="${d}"/></svg>`);
  const { width: W, pixels } = img;
  let sum = 0, sx = 0, sy = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    const a = pixels[i] / 255;
    if (!a) continue;
    const p = (i - 3) / 4;
    sum += a; sx += a * (p % W); sy += a * Math.floor(p / W);
  }
  info.massX = (sx / sum - 50) / s + bb.x1; // font units
  info.massY = (450 - sy / sum) / s;
  const row = Math.round(450 - 0.25 * 400); // through the lower bowl
  let x = 0;
  while (pixels[(row * W + x) * 4 + 3] < 128) x++;
  const x0 = x;
  while (pixels[(row * W + x) * 4 + 3] >= 128) x++;
  info.stem = (x - x0) / s;
  return info;
}

function pathD(cmds, tf) {
  const f = (v) => +v.toFixed(3);
  let d = '';
  for (const c of cmds) {
    if (c.type === 'Z') { d += 'Z'; continue; }
    const pts = [];
    if (c.type === 'C') pts.push(tf(c.x1, c.y1), tf(c.x2, c.y2));
    if (c.type === 'Q') pts.push(tf(c.x1, c.y1));
    pts.push(tf(c.x, c.y));
    d += c.type + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' ');
  }
  return d;
}

// Outer contour only (largest subpath), so a dilated plate has no counters.
function outerContour(cmds) {
  const subs = [];
  for (const c of cmds) {
    if (c.type === 'M') subs.push([]);
    subs[subs.length - 1].push(c);
  }
  const area = (sub) => {
    const p = sub.filter((c) => c.type !== 'Z');
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length];
      a += p[i].x * q.y - q.x * p[i].y;
    }
    return Math.abs(a / 2);
  };
  return subs.sort((a, b) => area(b) - area(a))[0];
}

// Grid fitting for the small sizes. A font outline at 8 to 16 px lands its bars and stems between
// pixels and turns grey. This searches a small affine adjustment (scale ±8 % per axis, sub-pixel
// shift) that keeps the outline as is but makes the most pixels fully on or fully off.
// The B stays centred within half a pixel.
const fitCachePath = path.join(OUT, 'fit-cache.json');
const fitCache = fs.existsSync(fitCachePath) ? JSON.parse(fs.readFileSync(fitCachePath, 'utf8')) : {};
function fitGlyph(gi, opts) {
  const key = `${gi.key}:${opts.capH}:${opts.cx}:${opts.cy}`;
  if (!fitCache[key]) {
    const { sx, sy, ox, oy } = searchFit(gi, opts);
    fitCache[key] = { sx, sy, ox, oy };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(fitCachePath, JSON.stringify(fitCache, null, 1));
  }
  const { sx, sy, ox, oy } = fitCache[key];
  const r = fitTransform(gi, opts, sx, sy, ox, oy);
  return { d: r.d, outer: pathD(outerContour(gi.cmds), r.tf), box: r.box, sx, sy };
}

function fitTransform(gi, { capH, cx, cy }, sx, sy, ox, oy) {
  const boxCx = (gi.bb.x1 + gi.bb.x2) / 2, boxCy = gi.cap / 2;
  const s = capH / gi.cap;
  const dx = ((gi.massX - boxCx) * s * sx) / 2;
  const dy = (-(gi.massY - boxCy) * s * sy) / 2;
  const w = (gi.bb.x2 - gi.bb.x1) * s * sx, hh = capH * sy;
  const left = cx - dx - w / 2 + ox, base = cy - dy + hh / 2 + oy;
  const tf = (x, y) => [left + (x - gi.bb.x1) * s * sx, base - y * s * sy];
  return { tf, d: pathD(gi.cmds, tf), box: [left, base - hh, left + w, base] };
}

function searchFit(gi, { capH, cx, cy }) {
  const boxCx = (gi.bb.x1 + gi.bb.x2) / 2, boxCy = gi.cap / 2;
  const s = capH / gi.cap;
  const n = Math.ceil(cx * 2);
  const evaluate = (sx, sy, ox, oy) => {
    const dx = ((gi.massX - boxCx) * s * sx) / 2;
    const dy = (-(gi.massY - boxCy) * s * sy) / 2;
    const w = (gi.bb.x2 - gi.bb.x1) * s * sx, hh = capH * sy;
    const left = cx - dx - w / 2 + ox, base = cy - dy + hh / 2 + oy;
    const tf = (x, y) => [left + (x - gi.bb.x1) * s * sx, base - y * s * sy];
    const d = pathD(gi.cmds, tf);
    const img = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><path d="${d}"/></svg>`);
    let grey = 0;
    for (let i = 3; i < img.pixels.length; i += 4) grey += Math.min(img.pixels[i], 255 - img.pixels[i]) / 255;
    // Prefer the plain outline when the gain is small.
    const score = grey + 2 * (Math.abs(sx - 1) + Math.abs(sy - 1));
    return { score, grey, d, tf, box: [left, base - hh, left + w, base], sx, sy, ox, oy };
  };
  const scales = [], shifts = [];
  for (let v = 0.92; v <= 1.081; v += 0.01) scales.push(+v.toFixed(2));
  for (let v = -0.5; v <= 0.5; v += 0.0625) shifts.push(v);
  // Axis by axis: horizontal bars depend on (sy, oy), stems on (sx, ox).
  let best = evaluate(1, 1, 0, 0);
  for (let pass = 0; pass < 2; pass++) {
    for (const sy of scales) for (const oy of shifts) {
      const r = evaluate(best.sx, sy, best.ox, oy);
      if (r.score < best.score) best = r;
    }
    for (const sx of scales) for (const ox of shifts) {
      const r = evaluate(sx, best.sy, ox, best.oy);
      if (r.score < best.score) best = r;
    }
  }
  return best;
}

// Places the B: cap height in grid units, centre in canvas units. Snaps baseline, left edge and
// stem width to the grid (stem width through a small horizontal scale, at most ±8 %).
// "Optical" centre = halfway between the bounding-box centre and the ink centroid.
export function placeGlyph(gi, { capH, cx, cy, grid, fit }) {
  if (fit) return fitGlyph(gi, { capH, cx, cy });
  const s = capH / gi.cap;
  const stem = gi.stem * s;
  let sx = (Math.max(1, Math.round(stem / grid)) * grid) / stem;
  if (Math.abs(sx - 1) > 0.08) sx = 1;
  const w = (gi.bb.x2 - gi.bb.x1) * s * sx;
  const boxCx = (gi.bb.x1 + gi.bb.x2) / 2, boxCy = gi.cap / 2;
  const dx = ((gi.massX - boxCx) * s * sx) / 2;
  const dy = (-(gi.massY - boxCy) * s) / 2;
  const snap = (v) => Math.round(v / grid) * grid;
  const left = snap(cx - dx - w / 2);
  const base = snap(cy - dy + capH / 2);
  const tf = (x, y) => [left + (x - gi.bb.x1) * s * sx, base - y * s];
  return {
    d: pathD(gi.cmds, tf),
    outer: pathD(outerContour(gi.cmds), tf),
    box: [left, base - capH, left + w, base],
    sx,
  };
}

// ---------- wall ----------

function rowBricks(row, L, j) {
  const mod = L + j;
  let out = [];
  for (const [a, b] of row.segs) {
    let p = row.start;
    while (p > a) p -= mod;
    for (; p < b; p += mod) {
      const x0 = Math.max(p, a), x1 = Math.min(p + L, b);
      if (x1 > x0) out.push([x0, x1]);
    }
  }
  for (const [c0, c1] of row.cuts || []) {
    out = out.flatMap(([a, b]) => (c1 <= a || c0 >= b ? [[a, b]] : [[a, c0], [c1, b]].filter(([u, v]) => v > u)));
  }
  return out;
}

// Binary raster of a path on the grid, dilated by r grid cells (disc), returned as row runs.
function dilatedMask(d, canvas, grid, r) {
  const n = canvas / grid;
  const img = render(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${canvas} ${canvas}"><path d="${d}"/></svg>`,
  );
  const on = (x, y) => x >= 0 && y >= 0 && x < n && y < n && img.pixels[(y * n + x) * 4 + 3] > 0;
  const rects = [];
  for (let y = 0; y < n; y++) {
    let run = null;
    for (let x = 0; x <= n; x++) {
      let hit = false;
      for (let dy = -r; dy <= r && !hit && x < n; dy++)
        for (let dx = -r; dx <= r && !hit; dx++) if (dx * dx + dy * dy <= r * r + r && on(x + dx, y + dy)) hit = true;
      if (hit && run === null) run = x;
      if (!hit && run !== null) { rects.push([run * grid, y * grid, (x - run) * grid, grid]); run = null; }
    }
  }
  return rects;
}

const rect = ([x, y, w, h], fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// spec -> { body (SVG content without the <svg> wrapper), parts for checks }
function buildIcon(spec, glyphs) {
  const { t, h, j, L, grid, canvas } = spec;
  const gi = glyphs[spec.font];
  const B = placeGlyph(gi, { capH: spec.capH, cx: spec.cx, cy: spec.cy, grid, fit: grid === 1 });

  const body = []; // blue footprint (rows + plate), for the white border
  const bricks = [];
  for (const row of spec.rows) {
    for (const [a, b] of row.segs) body.push([a, row.y0, b - a, h]);
    for (const [a, b] of rowBricks(row, L, j)) bricks.push([a, row.y0, b - a, h]);
  }

  let plate = [];
  const snapOut = (v, dir) => (dir < 0 ? Math.floor(v / grid) : Math.ceil(v / grid)) * grid;
  if (spec.plate.type === 'rect' || spec.plate.type === 'frame') {
    const m = spec.plate.margin;
    const r = spec.plate.rect || [
      snapOut(B.box[0] - m, -1), snapOut(B.box[1] - m, -1),
      snapOut(B.box[2] + m, 1), snapOut(B.box[3] + m, 1),
    ];
    plate = [[r[0], r[1], r[2] - r[0], r[3] - r[1]]];
  } else if (spec.plate.type === 'contour') {
    plate = dilatedMask(B.outer, canvas, grid, spec.plate.margin / grid);
  }
  // The plate never grows the silhouette: clip it to the wall (rows plus the joints between them).
  const wall = [...body];
  spec.rows.forEach((row, k) => {
    const next = spec.rows[k + 1];
    if (!next) return;
    for (const [a, b] of row.segs) for (const [c, d] of next.segs) {
      const x0 = Math.max(a, c), x1 = Math.min(b, d);
      if (x1 > x0) wall.push([x0, row.y0 + h, x1 - x0, next.y0 - row.y0 - h]);
    }
  });
  const clip = ([x, y, w, hh]) => wall.map(([X, Y, W, H]) => {
    const x0 = Math.max(x, X), y0 = Math.max(y, Y), x1 = Math.min(x + w, X + W), y1 = Math.min(y + hh, Y + H);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }).filter(Boolean);
  if (spec.plate.clip !== false) plate = plate.flatMap(clip);

  const svgBody = [
    `<g fill="${WHITE}">${body.map(([x, y, w, hh]) => rect([x - t, y - t, w + 2 * t, hh + 2 * t], WHITE)).join('')}</g>`,
    `<g>${bricks.map((r) => rect(r, BLUE)).join('')}</g>`,
    `<g>${plate.map((r) => rect(r, BLUE)).join('')}</g>`,
    `<path d="${B.d}" fill="${WHITE}"/>`,
  ].join('\n');
  return { body: svgBody, glyph: B, plate, gi };
}

const svgDoc = (body, viewBox, size, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" shape-rendering="crispEdges">` +
  `<title>${title}</title>\n${body}\n</svg>\n`;
// crispEdges applies to the rects; the B path gets normal anti-aliasing below.
const fixGlyphAA = (svg) => svg.replace('<path d=', '<path shape-rendering="geometricPrecision" d=');

// ---------- variants ----------

// Master grid (128 canvas, 96 content): bricks 26 x 8, joints 2, border 4, 9 rows.
// Every coordinate is even, so the 48 px export (viewBox 16 16 96 96, 2 units per pixel) is
// pixel-exact too.
const MASTER = { canvas: 128, grid: 2, t: 4, h: 8, j: 2, L: 26, cx: 63, cy: 64 };
const FULL = [22, 104];
const masterRow = (k, segs, cuts) => ({ y0: 20 + 10 * k, start: k % 2 ? 8 : 22, segs, cuts });
const masterRows = (segsFor, cutsFor = () => undefined) =>
  Array.from({ length: 9 }, (_, k) => masterRow(k, segsFor(k), cutsFor(k)));

// Small grids. 3 rows; middle row = one whole brick, outer rows = two halves (running bond).
const SMALL = {
  16: { canvas: 16, grid: 1, t: 1, h: 4, j: 1, L: 13, ys: [1, 6, 11], full: [1, 14], cx: 7.5, cy: 8, half: -6, whole: 1 },
  24: { canvas: 24, grid: 1, t: 1, h: 6, j: 2, L: 20, ys: [1, 9, 17], full: [2, 22], cx: 12, cy: 12, half: -9, whole: 2 },
  32: { canvas: 32, grid: 1, t: 2, h: 8, j: 2, L: 26, ys: [2, 12, 22], full: [3, 29], cx: 16, cy: 16, half: -11, whole: 3 },
};
const smallRows = (g, outer, middle = [g.full], cuts) => [
  { y0: g.ys[0], start: g.half, segs: outer.top },
  { y0: g.ys[1], start: g.whole, segs: middle, cuts },
  { y0: g.ys[2], start: g.half, segs: outer.bottom },
];
const inset = (g, n) => [g.full[0] + n, g.full[1] - n];

export const VARIANTS = [
  {
    id: 'coussin',
    name: 'A · Coussin',
    blurb: 'Silhouette octogonale : une demi-brique retirée à chaque coin. B encastré : les joints s’arrêtent sur un champ rectangulaire autour de la lettre.',
    font: 'inter',
    master: { ...MASTER, font: 'inter', capH: 36, plate: { type: 'rect', margin: 6 },
      rows: masterRows((k) => (k === 0 || k === 8 ? [[36, 90]] : [FULL])) },
    small: (n) => {
      const g = SMALL[n];
      const o = [inset(g, { 16: 1, 24: 2, 32: 2 }[n])];
      return { ...g, font: 'inter', capH: n / 2,
        plate: { type: 'rect', margin: { 16: 1, 24: 1, 32: 2 }[n] }, rows: smallRows(g, { top: o, bottom: o }) };
    },
  },
  {
    id: 'pignon',
    name: 'B · Pignon',
    blurb: 'Silhouette en gradins : 1, 2 puis 3 briques, comme un pignon maçonné. B dans un cartouche : une grande pierre bordée de joints, entre deux piliers de demi-briques.',
    font: 'montserrat',
    master: { ...MASTER, font: 'montserrat', capH: 36, plate: { type: 'frame', rect: [36, 40, 90, 88] },
      rows: masterRows(
        (k) => (k === 0 || k === 8 ? [[50, 76]] : k === 1 || k === 7 ? [[36, 90]] : [FULL]),
        (k) => (k >= 2 && k <= 6 ? [[34, 36], [90, 92]] : undefined),
      ) },
    small: (n) => {
      const g = SMALL[n];
      const o = [inset(g, { 16: 2, 24: 3, 32: 4 }[n])];
      return { ...g, font: 'montserrat', capH: { 16: 7, 24: 11, 32: 14 }[n],
        plate: { type: 'rect', margin: { 16: 1, 24: 1, 32: 2 }[n] }, rows: smallRows(g, { top: o, bottom: o }) };
    },
  },
  {
    id: 'rempart',
    name: 'C · Rempart',
    blurb: 'Silhouette de rempart : deux merlons et un créneau en haut, une assise plus étroite en bas. B détouré : le mortier contourne la lettre à distance fixe.',
    font: 'archivo',
    master: { ...MASTER, font: 'archivo', capH: 38, plate: { type: 'contour', margin: 8 },
      rows: masterRows((k) => (k === 0 ? [[22, 48], [78, 104]] : k === 8 ? [[36, 90]] : [FULL])) },
    small: (n) => {
      const g = SMALL[n];
      const merlon = { 16: 4, 24: 6, 32: 7 }[n];
      const top = [[g.full[0], g.full[0] + merlon], [g.full[1] - merlon, g.full[1]]];
      // The crenel is shallower than a row here: the plate fills its lower part around the B.
      return { ...g, font: 'archivo', capH: n / 2,
        plate: { type: 'contour', margin: { 16: 1, 24: 1, 32: 2 }[n], clip: false },
        rows: smallRows(g, { top, bottom: [inset(g, 1)] }) };
    },
  },
];

export const SIZES = [16, 24, 32, 48, 128];

// Pixel checks on the real PNG.
// - offGrid: pixels away from the B that are not exactly transparent, blue or white
//   (0 means every joint and every edge falls on whole pixels).
// - margin: smallest number of solid blue pixels between the B and any joint, border or edge.
function checkIcon(img, svg, glyphD, n) {
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  const mask = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="${vb}"><path d="${glyphD}"/></svg>`).pixels;
  const p = img.pixels;
  const at = (x, y) => (y * n + x) * 4;
  const inB = (x, y) => x >= 0 && y >= 0 && x < n && y < n && mask[at(x, y) + 3] > 0;
  const nearB = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, y + dy)) return true; return false; };
  const isBlue = (i) => p[i + 3] === 255 && p[i] === 5 && p[i + 1] === 116 && p[i + 2] === 176;
  const isWhite = (i) => p[i + 3] === 255 && p[i] === 255 && p[i + 1] === 255 && p[i + 2] === 255;
  let offGrid = 0, margin = Infinity;
  const notBlue = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = at(x, y);
    if (inB(x, y)) continue;
    if (!nearB(x, y) && !(p[i + 3] === 0 || isBlue(i) || isWhite(i))) offGrid++;
    if (!isBlue(i)) notBlue.push([x, y]);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!inB(x, y)) continue;
    for (const [u, w] of notBlue) {
      const d = Math.max(Math.abs(u - x), Math.abs(w - y)) - 1;
      if (d < margin) margin = d;
    }
  }
  return { offGrid, margin };
}

export function buildAll() {
  const glyphs = Object.fromEntries(Object.keys(FONTS).map((k) => [k, glyphInfo(k)]));
  const result = [];
  fs.mkdirSync(OUT, { recursive: true });
  for (const v of VARIANTS) {
    const files = {};
    const m = buildIcon(v.master, glyphs);
    const masterSvg = fixGlyphAA(svgDoc(m.body, '0 0 128 128', 128, `BlueShield ${v.name}`));
    fs.writeFileSync(path.join(OUT, `${v.id}-master.svg`), masterSvg);
    files[128] = { svg: masterSvg, spec: v.master, built: m };
    files[48] = { svg: masterSvg.replace('width="128" height="128" viewBox="0 0 128 128"', 'width="48" height="48" viewBox="16 16 96 96"'), spec: v.master, built: m };
    for (const n of [16, 24, 32]) {
      const spec = v.small(n);
      const b = buildIcon(spec, glyphs);
      const svg = fixGlyphAA(svgDoc(b.body, `0 0 ${n} ${n}`, n, `BlueShield ${v.name} ${n}px`));
      fs.writeFileSync(path.join(OUT, `${v.id}-${n}.svg`), svg);
      files[n] = { svg, spec, built: b };
    }
    for (const n of SIZES) {
      const img = render(files[n].svg);
      const png = img.asPng();
      fs.writeFileSync(path.join(OUT, `${v.id}-${n}.png`), png);
      files[n].png = png;
      files[n].check = checkIcon(img, files[n].svg, files[n].built.glyph.d, n);
    }
    result.push({ v, files, glyph: glyphs[v.font] });
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = buildAll();
  for (const { v, files } of r)
    console.log(v.id.padEnd(8), SIZES.map((n) => `${n}: grid ${files[n].check.offGrid} marge ${files[n].check.margin}px box ${files[n].built.glyph.box.map((q) => +q.toFixed(1)).join(',')}`).join(' | '));
}
