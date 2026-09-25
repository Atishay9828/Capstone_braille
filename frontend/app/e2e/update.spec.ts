/**
 * Does a new Braillix actually reach the person using it?
 *
 * The offline copy is what makes this app survive a school's Wi-Fi, and it is also what can stop a
 * fix from ever arriving: a service worker serves the page it already has, so the visit *after* a
 * release still shows the old build. That was true of the live site until it was found by deploying
 * and looking, and nothing on screen said a word about it.
 *
 * So this test does the real thing rather than a mock of it: install the worker, let it take
 * control, change the worker on disk exactly as a deploy would, and ask the browser to look again.
 * The notice must appear — and on a first visit, when there is nothing to be newer than, it must
 * not.
 */

import { expect, test } from '@playwright/test';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SW = join('dist', 'sw.js');

test.describe('a newer version', () => {
  test('says nothing on a first visit — an install is not an update', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('update-reload')).toHaveCount(0);
  });

  test('announces itself when the deployed worker changes, and reloads on request', async ({ page }) => {
    const original = readFileSync(SW, 'utf8');
    try {
      await page.goto('/');
      await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

      // Wait for the worker to be installed AND controlling this page. Until it controls, there is
      // no "current version" for a new one to be newer than.
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });

      // A deploy, in one line: the same worker, different bytes.
      appendFileSync(SW, `\n/* changed by e2e at build-time-constant */\n`);

      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });

      const reload = page.getByTestId('update-reload');
      await expect(reload).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('A newer Braillix is ready on this machine.')).toBeVisible();

      // And the button does what it says.
      await reload.click();
      await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    } finally {
      writeFileSync(SW, original, 'utf8');
    }
  });
});
