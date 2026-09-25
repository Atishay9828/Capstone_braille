/**
 * The offline test.
 *
 * The brief's primary requirement is that the software is complete and genuinely working on its
 * own. This test enforces the strict reading of that: with **every external request blocked**, the
 * whole product still works. Any dependency that quietly reaches for a CDN — a font, a locale file,
 * a model hub — fails here rather than in a room with bad Wi-Fi.
 */

import { expect, test, type Page } from '@playwright/test';

/** Block everything that is not the app's own origin. */
async function goOffline(page: Page): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:4173') || url.startsWith('data:') || url.startsWith('blob:')) {
      await route.continue();
      return;
    }
    blocked.push(url);
    await route.abort();
  });
  return blocked;
}

test.describe('with the network unplugged', () => {
  test('the core journey works and nothing external is even attempted', async ({ page }) => {
    const blocked = await goOffline(page);
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 25_000 });

    // Translation, the display, and the cam numbers all work.
    await page.getByTestId('latex-input').fill('2+3=5');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢');
    await expect(page.getByTestId('cell-0')).toHaveAttribute('data-cam', '60');

    // Not one request left the origin. If a dependency ever starts reaching for a CDN, this fails.
    expect(blocked, `blocked external requests:\n${blocked.join('\n')}`).toEqual([]);
  });

  test('the reader and the atlas both work offline', async ({ page }) => {
    const blocked = await goOffline(page);
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 25_000 });

    await page.getByTestId('speech-toggle').click();
    await page.getByTestId('latex-input').fill(String.raw`\frac{1}{2a}`);
    await page.waitForTimeout(400);
    await page.getByTestId('explore-toggle').click();
    await page.getByTestId('mode-explore').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
    await page.getByTestId('go-in').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Numerator');

    await page.getByTestId('nav-device').click();
    await page.getByTestId('device-atlas').click();
    await expect(page.locator('.atlas__item')).toHaveCount(64);

    expect(blocked, `blocked external requests:\n${blocked.join('\n')}`).toEqual([]);
  });

  test('the typeface is the real one, not a fallback', async ({ page }) => {
    // A demo in a fallback font looks broken. Fonts are self-hosted for exactly this reason.
    await goOffline(page);
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 25_000 });

    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    expect(loaded.join(','), 'IBM Plex should have loaded from our own origin').toContain('IBM Plex');
  });
});

/**
 * The strongest version of the offline claim: not "we blocked the CDN", but "the network is gone".
 *
 * A school hall has no Wi-Fi, a hotspot runs out of data, a router is switched off at four o'clock.
 * Once Braillix has been opened once, none of that is allowed to matter.
 */
test.describe('with the network genuinely switched off', () => {
  test('the app opens again from the copy on this machine', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    // Wait until the service worker is not just registered but in charge of this page.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 });

    await context.setOffline(true);
    try {
      await page.reload();

      // It opened, it translated, and it did all of that with nothing to talk to.
      await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
      await page.getByTestId('latex-input').fill('1/2');
      await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠂⠌⠆⠼', { timeout: 20_000 });

      // And the interface still switches language, because those words were cached too.
      await page.getByTestId('lang-hi').click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('गणित');
    } finally {
      await context.setOffline(false);
    }
  });
});
