/**
 * How well does the recogniser actually do on each shipped sample?
 *
 * Not a pass/fail test of the model — it is a 20M-parameter network and it will be wrong sometimes.
 * This runs every sample and reports what came back, so `docs/DEMO.md` can recommend the ones that
 * genuinely work and be honest about the ones that do not. Finding that out here is much cheaper
 * than finding it out in front of a panel.
 *
 * Skips itself when the model is not installed.
 */

import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MODEL_PRESENT = existsSync(join(process.cwd(), 'public', 'models', 'formulanet', 'onnx', 'encoder_model.onnx'));

const SAMPLES = [
  { file: 'quadratic.svg', shows: 'x^2 + 3x + 2 = 0' },
  { file: 'fraction.svg', shows: '22/7' },
  { file: 'root.svg', shows: 'sqrt(144) = 12' },
  { file: 'pythagoras.svg', shows: 'a^2 + b^2 = c^2' },
  { file: 'sum.svg', shows: 'sum from i=1 to n of i' },
  { file: 'handwritten.svg', shows: 'x^2 + 5x = 6 (handwriting style)' },
];

test.describe('recognition quality on the shipped samples', () => {
  test.skip(!MODEL_PRESENT, 'run `npm run fetch:model` to measure the real recogniser');

  test('report what every sample reads as', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/');
    await page.getByTestId('tray-scan').click();

    const results: string[] = [];

    for (const sample of SAMPLES) {
      await page.getByTestId(`sample-${sample.file}`).click();
      await page.getByTestId('run-recognition').click();
      await expect(page.getByTestId('rec-latex')).toBeVisible({ timeout: 150_000 });

      const latex = (await page.getByTestId('rec-latex').inputValue()).trim();
      const quality = (await page.getByTestId('rec-quality').textContent())?.split('·')[0].trim() ?? '?';

      results.push(`${sample.file.padEnd(20)} shows: ${sample.shows.padEnd(28)} read as: ${JSON.stringify(latex)}  [${quality}]`);

      // Whatever it reads, it must produce SOMETHING and judge it — silence would be the real bug.
      expect(latex.length, `${sample.file} returned nothing`).toBeGreaterThan(0);
    }

    console.log('\n=== RECOGNITION ON THE SHIPPED SAMPLES ===\n' + results.join('\n') + '\n');
  });
});
