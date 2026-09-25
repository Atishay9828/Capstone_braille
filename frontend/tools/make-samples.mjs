#!/usr/bin/env node
/**
 * Generate the sample images shipped with Braillix.
 *
 * The demo must never depend on the room's lighting, on a phone being to hand, or on someone's
 * handwriting being legible today. These are committed so "photograph an equation" can be shown
 * in a windowless room with no camera.
 *
 * They are SVG so they stay a few kilobytes and render crisply at any size; the browser rasterises
 * them before they reach the recogniser, exactly as it would a photograph.
 *
 *   node tools/make-samples.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'public', 'samples');

const W = 640;
const H = 240;

/** A printed-textbook look: italic serif, the way maths is actually set. */
const printed = (body, { size = 72 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g fill="#111111" font-family="Cambria, 'Times New Roman', Georgia, serif" font-style="italic" font-size="${size}" text-anchor="middle">
${body}
  </g>
</svg>
`;

/** A pen-on-paper look: upright, slightly irregular, on faint ruled paper. */
const handwritten = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fdfdfa"/>
  <g stroke="#dfe6ef" stroke-width="1">
    <line x1="0" y1="60" x2="${W}" y2="60"/>
    <line x1="0" y1="120" x2="${W}" y2="120"/>
    <line x1="0" y1="180" x2="${W}" y2="180"/>
  </g>
  <g fill="#1a2740" font-family="'Segoe Script', 'Comic Sans MS', 'Bradley Hand', cursive" font-size="64">
${body}
  </g>
</svg>
`;

const SAMPLES = {
  // x² + 3x + 2 = 0
  'quadratic.svg': printed(
    `    <text x="320" y="145">x<tspan font-size="42" dy="-28">2</tspan><tspan dy="28"> + 3x + 2 = 0</tspan></text>`,
  ),

  // 22 over 7, drawn as a real fraction with a rule
  'fraction.svg': printed(
    `    <text x="300" y="105">22</text>
    <line x1="255" y1="125" x2="345" y2="125" stroke="#111111" stroke-width="4"/>
    <text x="300" y="200">7</text>`,
  ),

  // √144 = 12, with a drawn radical
  'root.svg': printed(
    `    <path d="M 170 130 l 18 0 l 16 42 l 26 -92 l 150 0" fill="none" stroke="#111111" stroke-width="4"/>
    <text x="300" y="150">144</text>
    <text x="440" y="150">= 12</text>`,
  ),

  // a² + b² = c²
  'pythagoras.svg': printed(
    `    <text x="320" y="145">a<tspan font-size="42" dy="-28">2</tspan><tspan dy="28"> + b</tspan><tspan font-size="42" dy="-28">2</tspan><tspan dy="28"> = c</tspan><tspan font-size="42" dy="-28">2</tspan></text>`,
  ),

  // Σ from i=1 to n of i
  'sum.svg': printed(
    `    <text x="230" y="150" font-style="normal" font-size="96">&#8721;</text>
    <text x="230" y="200" font-size="30">i = 1</text>
    <text x="230" y="72" font-size="30">n</text>
    <text x="330" y="150">i</text>`,
    { size: 72 },
  ),

  // Deliberately imperfect: uneven baselines, the way a student writes.
  'handwritten.svg': handwritten(
    `    <text x="90" y="118" transform="rotate(-1.5 90 118)">x</text>
    <text x="128" y="92" font-size="38" transform="rotate(-2 128 92)">2</text>
    <text x="168" y="122" transform="rotate(1 168 122)">+</text>
    <text x="228" y="116" transform="rotate(-1 228 116)">5x</text>
    <text x="308" y="124" transform="rotate(2 308 124)">=</text>
    <text x="372" y="118" transform="rotate(-1 372 118)">6</text>`,
  ),
};

await mkdir(OUT, { recursive: true });
for (const [name, svg] of Object.entries(SAMPLES)) {
  await writeFile(join(OUT, name), svg, 'utf8');
  console.log(`  · ${name}`);
}
console.log(`\n${Object.keys(SAMPLES).length} sample images written to app/public/samples`);
