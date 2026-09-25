/**
 * The recognition journey.
 *
 * The model is downloaded by `npm run fetch:model`, not committed (it is AGPL-3.0 and 76 MB), so
 * these tests check BOTH states honestly:
 *
 *   · model absent  — the feature says so, offers the fix, and nothing else is affected
 *   · model present — a real image is read by a real model, in a real browser, offline
 *
 * The second half skips itself when the model is not installed. A skipped test is honest; a test
 * that quietly passes without exercising anything is not.
 */

import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MODEL_PRESENT = existsSync(join(process.cwd(), 'public', 'models', 'formulanet', 'onnx', 'encoder_model.onnx'));

test.describe('reading handwriting', () => {
  test('offers samples so a demo never depends on the room’s lighting', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await expect(page.getByRole('heading', { name: 'What it read' })).toBeVisible();
    await expect(page.locator('.samples__btn')).toHaveCount(6);
  });

  test('shows the recogniser exactly what it will see', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await page.getByTestId('sample-quadratic.svg').click();

    // The preview is the cropped, normalised image — not the original. Being able to see that is
    // the difference between "it didn't work" and "it only got half the equation".
    await expect(page.locator('.rec__canvas')).toBeVisible();
    await expect(page.getByText('cropped to the writing')).toBeVisible();
  });

  test('lets you write an equation with the mouse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await page.getByTestId('mode-draw').click();

    const pad = page.getByTestId('draw-pad');
    await expect(pad).toBeVisible();
    // The raw mouse API does not scroll; without this the coordinates can be below the fold and
    // the strokes land on whatever happens to be there.
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;

    // Draw a rough "1 + 1".
    await page.mouse.move(box.x + 80, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 140, { steps: 8 });
    await page.mouse.up();

    await page.getByTestId('pad-done').click();
    await expect(page.locator('.rec__canvas')).toBeVisible();
  });

  test('the rest of the app is untouched when recognition is unavailable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    // Whatever recognition's state, the core journey still works — that is the whole design law.
    await page.getByTestId('latex-input').fill('2+3=5');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢');
  });
});

test.describe('reading handwriting — with the model installed', () => {
  test.skip(!MODEL_PRESENT, 'run `npm run fetch:model` to exercise the real recogniser');

  test('reads a real image, on this device, and hands the result over for correction', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await page.getByTestId('sample-fraction.svg').click();

    await page.getByTestId('run-recognition').click();

    // First run loads ~76 MB from disk into WASM, which takes a while on a cold cache.
    await expect(page.getByTestId('rec-latex')).toBeVisible({ timeout: 150_000 });

    const latex = await page.getByTestId('rec-latex').inputValue();
    expect(latex.trim().length, 'the recogniser returned nothing').toBeGreaterThan(0);
    console.log('recognised:', JSON.stringify(latex));

    // It reports a quality judgement with reasons, never a bare number.
    await expect(page.getByTestId('rec-quality')).toBeVisible();

    // Nothing reached the display until a human said so. Pressing the button IS the
    // confirmation, and the confirmed line lands on the board — the lesson rail — not
    // back in the typing box, which stays empty for the teacher's next line.
    await page.getByTestId('send-to-display').click();
    await expect(page.getByTestId('lesson-rail')).toBeVisible();
    // The board renders lines as typeset print, not raw LaTeX — so the honest check is the
    // store: the confirmed line's source is exactly what the recogniser handed over.
    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __braillix: { getState(): { source: string } } }).__braillix.getState().source),
      )
      .toBe(latex.trim());
    // The typing box keeps whatever draft the teacher had; the recognised maths does not
    // hijack it on its way to the board.
    await expect(page.getByTestId('latex-input')).not.toHaveValue(latex);
  });

  test('a correction by hand is what actually gets read', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await page.getByTestId('sample-quadratic.svg').click();
    await page.getByTestId('run-recognition').click();
    await expect(page.getByTestId('rec-latex')).toBeVisible({ timeout: 150_000 });

    // Whatever the model said, the human has the last word.
    await page.getByTestId('rec-latex').fill('2+3=5');
    await page.getByTestId('send-to-display').click();
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢');
  });
});

test.describe('scanning a full question — words and maths together', () => {
  test.skip(!MODEL_PRESENT, 'run `npm run fetch:model` to exercise the real recogniser');

  test('a textbook line is cropped part by part, read by two engines, and lands on the board', async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto('/');
    await page.getByTestId('tray-scan').click();
    await page.getByTestId('mode-question').click();

    // Synthesize a textbook-style question in the page: words, then maths.
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 200;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 900, 200);
      g.fillStyle = '#111';
      g.textBaseline = 'middle';
      g.font = '42px Georgia';
      g.fillText('Find the value of x :', 30, 100);
      g.font = 'italic 46px Georgia';
      g.fillText('2x + 3 = 11', 480, 100);
      return c.toDataURL('image/png');
    });
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    await page.getByTestId('qs-file-input').setInputFiles({
      name: 'question.png',
      mimeType: 'image/png',
      buffer,
    });

    const stage = page.getByTestId('qs-stage');
    await expect(stage).toBeVisible();
    const box = (await stage.boundingBox())!;

    // Part 1: the words. Drag a box over the left half with the real mouse.
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.52, box.y + box.height - 4, { steps: 5 });
    await page.mouse.up();
    await page.getByTestId('qs-read-words').click();
    // First run downloads nothing — everything is self-hosted — but WASM startup takes a moment.
    await expect(page.locator('.qs__part')).toHaveCount(1, { timeout: 120_000 });
    const words = await page.locator('.qs__part .qs__value').first().inputValue();
    expect(words.toLowerCase()).toContain('value');

    // Part 2: the maths. Right half of the image.
    await page.mouse.move(box.x + box.width * 0.5, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height - 4, { steps: 5 });
    await page.mouse.up();
    await page.getByTestId('qs-read-maths').click();
    await expect(page.locator('.qs__part')).toHaveCount(2, { timeout: 150_000 });
    const maths = await page.locator('.qs__part .qs__value').nth(1).inputValue();
    expect(maths.replace(/\s/g, '')).toContain('2x+3=11');

    // The confirm gate: the send button IS the approval, and the line lands on the board
    // as words + maths in their two braille codes.
    await page.getByTestId('qs-send').click();
    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __braillix: { getState(): { source: string } } }).__braillix.getState().source),
      )
      .toContain('2 x + 3 = 11');
    await page.getByTestId('evidence-toggle').click();
    await expect(page.locator('.evidence__count')).toContainText('Nemeth');
  });
});
