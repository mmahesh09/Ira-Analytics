// Generates public/world-dots.svg: the static dot layer of the CTA world map.
// One cached image instead of ~1,900 inline <circle> nodes. Re-run after changing the map settings:
//   node scripts/build-world-dots.mjs
import { writeFileSync } from "node:fs";
import { createMap } from "svg-dotted-map";

const WIDTH = 150;
const HEIGHT = 75;
const RADIUS = 0.3;
const FILL = "#ffffff";
const OPACITY = 0.22;

const { points } = createMap({ width: WIDTH, height: HEIGHT, mapSamples: 5000 });

// same row stagger as components/ui/dotted-map.tsx
const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
const rows = new Map();
let step = 0;
let prevY = NaN;
let prevX = NaN;
for (const p of sorted) {
  if (p.y !== prevY) {
    prevY = p.y;
    prevX = NaN;
    if (!rows.has(p.y)) rows.set(p.y, rows.size);
  }
  if (!Number.isNaN(prevX)) {
    const d = p.x - prevX;
    if (d > 0) step = step === 0 ? d : Math.min(step, d);
  }
  prevX = p.x;
}
const half = (step || 1) / 2;

const r = (n) => Math.round(n * 100) / 100;
const path = points
  .map((p) => {
    const x = p.x + ((rows.get(p.y) ?? 0) % 2 === 1 ? half : 0);
    return `M${r(x - RADIUS)} ${r(p.y)}a${RADIUS} ${RADIUS} 0 1 0 ${RADIUS * 2} 0a${RADIUS} ${RADIUS} 0 1 0 ${-RADIUS * 2} 0`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"><path fill="${FILL}" fill-opacity="${OPACITY}" d="${path}"/></svg>`;
writeFileSync(new URL("../public/world-dots.svg", import.meta.url), svg);
console.log(`world-dots.svg: ${points.length} dots, ${(svg.length / 1024).toFixed(1)} KB`);
