// Samples points along the Africa outline so the hero constellation never has
// to parse SVG in the browser. Run: node scripts/make-africa-points.mjs
//
// Input:  scripts/africa-outline.svg (the outline from the 2025 site)
// Output: src/components/hero/africa-points.json — an array of [x, y] pairs
//         normalised to a 0..1 square, y pointing down, longest side = 1.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { svgPathProperties } from 'svg-path-properties';

const TARGET_POINTS = 720;
const svg = readFileSync(new URL('./africa-outline.svg', import.meta.url), 'utf8');

// One transform on the wrapping <g>, if any: translate(tx,ty) scale(sx,sy).
let tx = 0, ty = 0, sx = 1, sy = 1;
const g = svg.match(/<g[^>]*transform="([^"]+)"/);
if (g) {
  const t = g[1].match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/);
  const s = g[1].match(/scale\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/);
  if (t) { tx = Number(t[1]); ty = Number(t[2]); }
  if (s) { sx = Number(s[1]); sy = s[2] !== undefined ? Number(s[2]) : sx; }
}

const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
if (paths.length === 0) throw new Error('no paths found');

const props = paths.map((d) => new svgPathProperties(d));
const lengths = props.map((p) => p.getTotalLength());
const total = lengths.reduce((a, b) => a + b, 0);

const raw = [];
props.forEach((p, i) => {
  // Small islands still get a few points, the mainland gets most.
  const n = Math.max(6, Math.round((lengths[i] / total) * TARGET_POINTS));
  for (let k = 0; k < n; k++) {
    const pt = p.getPointAtLength((k / n) * lengths[i]);
    raw.push([pt.x * sx + tx, pt.y * sy + ty]);
  }
});

const xs = raw.map((p) => p[0]);
const ys = raw.map((p) => p[1]);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const range = Math.max(maxX - minX, maxY - minY);
// Centre the shorter axis inside the square.
const padX = (range - (maxX - minX)) / 2;
const padY = (range - (maxY - minY)) / 2;

const points = raw.map(([x, y]) => [
  Number((((x - minX) + padX) / range).toFixed(4)),
  Number((((y - minY) + padY) / range).toFixed(4)),
]);

mkdirSync(new URL('../src/components/hero/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../src/components/hero/africa-points.json', import.meta.url),
  JSON.stringify(points)
);
console.log(`wrote ${points.length} points from ${paths.length} paths`);
