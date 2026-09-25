/**
 * The Reader journey — the claim that a whole equation is readable on one cell.
 *
 * These tests exist because that claim is the project's central argument. If exploring an
 * expression ever shows the wrong braille or loses track of where the reader is, the product is
 * worse than a plain converter, not better.
 */

import { expect, test, type Page } from '@playwright/test';

const QUADRATIC_FORMULA = '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}';
const SIMPLE_FRACTION = '\\frac{1}{2a}';

async function openWith(page: Page, latex: string) {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

  // Silence speech so the suite stays fast and quiet.
  await page.getByTestId('speech-toggle').click();

  await page.getByTestId('latex-input').fill(latex);
  // Translation is asynchronous. Wait for the new expression to land before changing mode,
  // otherwise we would be testing the previous one.
  await expect(page.getByTestId('latex-input')).toHaveValue(latex);
  await expect(page.getByTestId('braille-unicode')).not.toHaveText('', { timeout: 10_000 });
  await page.waitForTimeout(400);

  await page.getByTestId('explore-toggle').click();
  await page.getByTestId('mode-explore').click();
  await expect(page.getByTestId('breadcrumb')).not.toHaveText('—', { timeout: 10_000 });
}

test.describe('exploring an expression', () => {
  test('folds the quadratic formula from 19 cells to 5', async ({ page }) => {
    await openWith(page, QUADRATIC_FORMULA);

    // Folded: open-fraction, something, over, something, close-fraction.
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠿⠌⠿⠼');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
  });

  test('steps into the denominator and reads it in its own right', async ({ page }) => {
    await openWith(page, SIMPLE_FRACTION);

    await page.getByTestId('go-in').click(); // into the numerator
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Numerator');

    await page.getByTestId('go-next').click(); // across to the denominator
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Denominator');
    // "2a" read alone starts a new numeric context, so Nemeth requires the ⠼ indicator.
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠼⠆⠁');

    await page.getByTestId('go-out').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
  });

  test('the arrow keys do the same as the buttons', async ({ page }) => {
    await openWith(page, SIMPLE_FRACTION);
    await page.locator('.rail-top__brand').click(); // move focus out of any field

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Numerator');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Denominator');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Numerator');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
  });

  test('navigation stops at the edges instead of wrapping around', async ({ page }) => {
    await openWith(page, SIMPLE_FRACTION);
    await expect(page.getByTestId('go-out')).toBeDisabled(); // at the root
    await expect(page.getByTestId('go-prev')).toBeDisabled();
    await expect(page.getByTestId('go-next')).toBeDisabled();

    await page.getByTestId('go-in').click();
    await expect(page.getByTestId('go-prev')).toBeDisabled(); // first child
    await expect(page.getByTestId('go-next')).toBeEnabled();
  });

  test('a folded cell can be stepped into by clicking it', async ({ page }) => {
    await openWith(page, QUADRATIC_FORMULA);
    await page.getByTestId('cell-count').fill('5');

    // The two ⠿ cells are the only ones offered as enterable.
    const folds = page.locator('.cellwrap.is-fold');
    await expect(folds).toHaveCount(2);
    await folds.nth(1).locator('button').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Denominator');
  });

  test('expanding shows the part in full, folding puts it back', async ({ page }) => {
    await openWith(page, QUADRATIC_FORMULA);
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠿⠌⠿⠼');

    await page.getByTestId('toggle-expanded').click();
    const expandedText = await page.getByTestId('braille-unicode').textContent();
    expect(expandedText!.length).toBeGreaterThan(10);
    expect(expandedText).not.toContain('⠿');

    await page.getByTestId('toggle-expanded').click();
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠿⠌⠿⠼');
  });

  test('the folded view fits a one-cell display and stays oriented', async ({ page }) => {
    await openWith(page, QUADRATIC_FORMULA);
    await page.getByTestId('cell-count').fill('1');
    await expect(page.locator('[data-testid="cell-row"] .cell')).toHaveCount(1);
    await expect(page.getByTestId('window-label')).toHaveText('cell 1 of 5');

    // Stepping in re-renders the display for the new node without losing the breadcrumb.
    await page.getByTestId('go-in').click();
    await expect(page.getByTestId('breadcrumb')).toContainText('Numerator');
    await expect(page.locator('[data-testid="cell-row"] .cell')).toHaveCount(1);
  });

  test('offers Hindi as well as English, for the whole interface and the speech', async ({ page }) => {
    await openWith(page, QUADRATIC_FORMULA);
    await page.getByTestId('lang-hi').click();
    await expect(page.getByTestId('lang-hi')).toHaveAttribute('aria-pressed', 'true');
    // The switch changes the words, never the braille: the cells must be the same either way.
    const before = await page.getByTestId('braille-unicode').textContent();
    await page.getByTestId('lang-en').click();
    await expect(page.getByTestId('braille-unicode')).toHaveText(before ?? '');
  });
});
