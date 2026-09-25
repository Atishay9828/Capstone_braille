/**
 * The ink strip — the v4 flagship, walked with a real mouse.
 *
 * The claim is the founder's own sentence: writing on the board should feel like chalk. So
 * this draws actual strokes on the strip, waits for the on-device recogniser to read them,
 * and follows the reading through the one confirm gate onto the board. The model's exact
 * output for machine-drawn strokes is not asserted — that would be a statement about the
 * model's taste in synthetic handwriting — but the MECHANISM is: strokes in, a reading in
 * the box, a preview to check, a press to commit, ghost ink on the landed line.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
  await page.getByTestId('speech-toggle').click(); // quiet suite
}

/** Draw one stroke on the ink canvas, coordinates as fractions of its box. */
async function stroke(page: Page, points: [number, number][]) {
  const box = (await page.getByTestId('ink-canvas').boundingBox())!;
  const [first, ...rest] = points.map(([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy }));
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();
}

test.describe('writing on the board', () => {
  test('strokes become a reading, the reading becomes a line, the line keeps the hand', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);

    await page.getByTestId('tray-write').click();
    await expect(page.getByTestId('ink-strip')).toBeVisible();

    // Write an x: two crossing strokes, large, in the middle of the strip.
    await stroke(page, [
      [0.42, 0.2],
      [0.58, 0.8],
    ]);
    await stroke(page, [
      [0.58, 0.2],
      [0.42, 0.8],
    ]);

    // The pause fires the reading; the first read may also pay the model's load time.
    await expect(page.getByTestId('latex-input')).not.toHaveValue('', { timeout: 150_000 });
    const reading = await page.getByTestId('latex-input').inputValue();
    console.log('ink read as:', JSON.stringify(reading));

    // The preview is up — the teacher can check before anything reaches a child.
    await expect(page.getByTestId('tray-preview')).toBeVisible();

    // The ordinary Put press commits it — the same gate as typing.
    const before = await page.getByTestId('lesson-rail').locator('li').count();
    await page.getByTestId('commit-line').click();
    await expect(page.getByTestId('lesson-rail').locator('li')).toHaveCount(before + 1);

    // The board remembers the hand: the landed line carries the ghost ink.
    await expect(page.locator('.boardline__ghost')).toHaveCount(1);

    // And the strip has started the next line: canvas clear, box empty.
    await expect(page.getByTestId('latex-input')).toHaveValue('');
  });

  test('the teacher\'s correction outranks the machine', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await page.getByTestId('tray-write').click();

    await stroke(page, [
      [0.42, 0.2],
      [0.58, 0.8],
    ]);
    await stroke(page, [
      [0.58, 0.2],
      [0.42, 0.8],
    ]);
    await expect(page.getByTestId('latex-input')).not.toHaveValue('', { timeout: 150_000 });

    // She fixes the reading by hand — the strip must never overwrite her text.
    await page.getByTestId('latex-input').fill('x + 1');
    await stroke(page, [
      [0.2, 0.5],
      [0.3, 0.5],
    ]);
    await page.waitForTimeout(2_500); // longer than the read pause
    await expect(page.getByTestId('latex-input')).toHaveValue('x + 1');
  });
});
