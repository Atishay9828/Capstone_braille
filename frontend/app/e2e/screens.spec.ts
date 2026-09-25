/**
 * Screenshots of every screen, at every width.
 *
 * "It compiles" proves nothing about how something looks, and this project's taste bar is that
 * nothing should invite the criticism "this looks like a college demo". So every screen is
 * captured, and every capture asserts the page does not scroll sideways.
 */

import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

/**
 * Every screen a teacher can reach, by the control they would press to get there.
 * `steps` is the sequence of test ids to click from a cold start; the Board needs none.
 */
const SCREENS = [
  { id: 'board', steps: [], heading: 'The blackboard' },
  { id: 'recognise', steps: ['tray-scan'], heading: 'The blackboard' },
  { id: 'device', steps: ['nav-device'], heading: 'Hardware' },
  { id: 'atlas', steps: ['nav-device', 'device-atlas'], heading: 'Cell atlas' },
] as const;

async function noSidewaysScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} must not scroll horizontally`).toBeLessThanOrEqual(1);
}

for (const size of WIDTHS) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    for (const screen of SCREENS) {
      test(`${screen.id}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('/');
        await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

        for (const step of screen.steps) await page.getByTestId(step).click();
        await expect(page.getByRole('heading', { name: screen.heading, level: 1 })).toBeVisible();

        // Give the cam animation time to settle so captures are not caught mid-transition.
        await page.waitForTimeout(600);
        await noSidewaysScroll(page, `${screen.id} at ${size.width}px`);
        await page.screenshot({ path: `${SHOTS}/${screen.id}-${size.name}.png`, fullPage: true });
      });
    }
  });
}

test.describe('states worth capturing', () => {
  test('the reader, mid-exploration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    await page.getByTestId('speech-toggle').click();
    await page.getByTestId('latex-input').fill(String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`);
    await page.waitForTimeout(600);
    await page.getByTestId('explore-toggle').click();
    await page.getByTestId('mode-explore').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
    await page.getByTestId('cell-count').fill('5');
    await page.waitForTimeout(600);
    await noSidewaysScroll(page, 'reader');
    await page.screenshot({ path: `${SHOTS}/reader-exploring.png`, fullPage: true });
  });

  test('a lesson with real questions on the board', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    for (const source of ['2/3 + 1/6', 'sqrt(144) = 12', 'दो संख्याओं का योग 12 है']) {
      await page.getByTestId('latex-input').fill(source);
      await page.getByTestId('commit-line').click();
    }
    // Three committed lines plus the seeded example a fresh machine opens with.
    await expect(page.getByTestId('lesson-rail').locator('li')).toHaveCount(4);
    await page.waitForTimeout(500);
    await noSidewaysScroll(page, 'the board with a lesson on it');
    await page.screenshot({ path: `${SHOTS}/board-lesson.png`, fullPage: true });
  });

  test('the self-check, run', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    await page.getByTestId('nav-help').click();
    await page.getByTestId('run-selfcheck').click();
    await expect(page.getByTestId('selfcheck-results')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    await noSidewaysScroll(page, 'help');
    await page.screenshot({ path: `${SHOTS}/help-selfcheck.png`, fullPage: true });
  });

});

/**
 * Long text does not push the page sideways.
 *
 * Found during a QA pass, not by reasoning: a three-hundred-character question — a thing a
 * teacher genuinely does when pasting out of a textbook — once gave a screen 1,762 pixels of
 * horizontal overflow. Wide *mathematics* is allowed to scroll inside its own box. The page
 * is not, and neither is the lesson rail.
 */
test.describe('nothing overflows, however long the words are', () => {
  const MONSTER = 'x'.repeat(300);

  for (const size of WIDTHS) {
    test(`${size.name}: a long question stays inside the page, in the box and on the board`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');
      await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

      await page.getByTestId('latex-input').fill(`${MONSTER} और ${'y'.repeat(150)}`);
      await page.waitForTimeout(400);
      await noSidewaysScroll(page, `board at ${size.width}px`);

      await page.getByTestId('commit-line').click();
      await page.getByTestId('latex-input').fill('दो संख्याओं का योग बहुत लंबा प्रश्न है '.repeat(4));
      await page.getByTestId('commit-line').click();
      await page.waitForTimeout(600);
      await noSidewaysScroll(page, `the lesson rail at ${size.width}px`);
    });
  }
});
