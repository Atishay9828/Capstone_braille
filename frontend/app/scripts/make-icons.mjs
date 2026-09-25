/**
 * The app icon: one braille cell showing ⠭ — the letter x.
 *
 * Run by hand (`node app/scripts/make-icons.mjs`) and the results are committed, because a build
 * that needs a native image library to produce an icon is a build that breaks on somebody else's
 * laptop. `sharp` is already present as a Node-only dependency of the ML library and never reaches
 * the browser bundle.
 *
 * The mark is the same one in the masthead: dots 1, 3, 4 and 6 raised, lit from the top left, on
 * the graphite ground. At 192 px it still reads as braille rather than as four grey circles.
 */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public', 'icons');

/** Dot positions in a 2×3 grid, and which of them are raised for ⠭ (dots 1, 3, 4, 6). */
const DOTS = [
  { x: 0, y: 0, on: true }, // 1
  { x: 0, y: 1, on: false }, // 2
  { x: 0, y: 2, on: true }, // 3
  { x: 1, y: 0, on: true }, // 4
  { x: 1, y: 1, on: false }, // 5
  { x: 1, y: 2, on: true }, // 6
];

function svg(size) {
  const pad = size * 0.18;
  const gapX = (size - pad * 2) / 1.6;
  const gapY = (size - pad * 2) / 2.6;
  const radius = size * 0.093;
  const originX = size / 2 - gapX / 2;
  const originY = size / 2 - gapY;

  const circles = DOTS.map((dot) => {
    const cx = originX + dot.x * gapX;
    const cy = originY + dot.y * gapY;
    return dot.on
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#dome)"/>` +
          `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${size * 0.006}"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${radius * 0.92}" fill="#07080a"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="dome" cx="34%" cy="30%" r="72%">
      <stop offset="0%" stop-color="#fdfdfc"/>
      <stop offset="42%" stop-color="#cfccc4"/>
      <stop offset="100%" stop-color="#7c7871"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#171b1e"/>
      <stop offset="100%" stop-color="#0b0d0f"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#ground)"/>
  <rect x="${size * 0.02}" y="${size * 0.02}" width="${size * 0.96}" height="${size * 0.96}" rx="${size * 0.16}"
        fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${size * 0.01}"/>
  ${circles}
</svg>`;
}

const sizes = [192, 512];
for (const size of sizes) {
  const source = Buffer.from(svg(size));
  await sharp(source).png().toFile(join(publicDir, `icon-${size}.png`));
  console.log(`icons/icon-${size}.png`);
}

// A maskable icon needs its content inside the safe zone, so it survives being cropped to a circle.
const maskable = Buffer.from(svg(512).replace('rx="92.16"', 'rx="0"'));
await sharp(maskable).resize(410, 410).extend({
  top: 51, bottom: 51, left: 51, right: 51,
  background: { r: 11, g: 13, b: 15, alpha: 1 },
}).png().toFile(join(publicDir, 'icon-maskable.png'));
console.log('icons/icon-maskable.png');

writeFileSync(join(publicDir, 'icon.svg'), svg(512), 'utf8');
console.log('icons/icon.svg');
