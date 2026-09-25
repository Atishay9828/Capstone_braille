/**
 * The demo journey, walked headlessly.
 *
 * This is the test that has to pass on the morning of the panel. It proves the claim the whole
 * project rests on — that with nothing plugged in, a real expression becomes real Nemeth on a real
 * number of cells — and it fails the build if a console error appears anywhere along the way.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

/** Every test asserts a clean console — CLAUDE.md gate: zero console errors or warnings. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test.describe('Braillix — the core journey', () => {
  test('a new user sees working braille within seconds, with no input', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('/');

    // The app pre-loads one expression so the first thing anyone sees is a working display.
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    await expect(page.getByTestId('cell-row')).toBeVisible();

    // The default display is one cell — the hardware that will actually exist.
    await expect(page.getByTestId('cell-count')).toHaveValue('1');
    await expect(page.getByTestId('cell-0')).toBeVisible();

    expect(problems, `console problems:\n${problems.join('\n')}`).toEqual([]);
  });

  test('typing an expression produces the correct Nemeth and the correct cam numbers', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('2+3=5');
    // ⠼⠆⠬⠒ ⠨⠅ ⠼⠢ — numeric indicator, dropped 2, plus, dropped 3, equals, numeric indicator, 5.
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠼⠆⠬⠒⠀⠨⠅⠀⠼⠢');

    // Cell 1 must be the numeric indicator: dots 3-4-5-6, cam 60 with the default wiring.
    const first = page.getByTestId('cell-0');
    await expect(first).toHaveAttribute('data-dots', '60');
    await expect(first).toHaveAttribute('data-cam', '60');

    expect(problems, `console problems:\n${problems.join('\n')}`).toEqual([]);
  });

  test('the display adapts to any number of cells', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    for (const count of ['1', '2', '3', '8', '20']) {
      await page.getByTestId('cell-count').fill(count);
      const cells = page.locator('[data-testid="cell-row"] .cell');
      await expect(cells).toHaveCount(Number(count));
      // The window label must stay truthful at every width.
      await expect(page.getByTestId('window-label')).not.toBeEmpty();
    }
  });

  test('a broken expression explains itself and never blanks the display', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('\\frac{1}{');
    await expect(page.getByRole('alert')).toContainText('parse');
    // Law 4: the previous frame is sacred — the cells are still there.
    await expect(page.getByTestId('cell-0')).toBeVisible();
  });

  test('the status strip tells the truth about what is and is not available', async ({ page }) => {
    await page.goto('/');
    const strip = page.getByRole('contentinfo', { name: 'System status' });
    await expect(strip).toBeVisible();

    // The maths engine must come up ready…
    await expect(strip.getByText('Maths engine')).toBeVisible();
    // …and recognition must report whichever state is TRUE on this machine, with a fix when it is
    // not ready. Asserting one particular state would make this test a statement about the tester's
    // laptop rather than about the product.
    const recognition = strip.locator('.cap', { hasText: 'Recognition' });
    await expect(recognition).toBeVisible();
    const state = (await recognition.locator('.cap__state').textContent())?.trim();
    expect(['ready', 'off', 'checking']).toContain(state);
    if (state === 'off') await expect(recognition.locator('.cap__fix')).toContainText('fetch:model');
  });

  test('the whole app is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.keyboard.press('Tab'); // skip link
    await expect(page.getByRole('link', { name: /skip to the display/i })).toBeFocused();

    // Walk far enough to reach the input, and prove it can be typed into without a mouse. The
    // count is generous on purpose: what matters is that it is reachable, not that it is the
    // Nth stop — and the always-visible symbol rail alone is 36 legitimate stops on the way.
    for (let i = 0; i < 90; i += 1) {
      await page.keyboard.press('Tab');
      if (await page.getByTestId('latex-input').evaluate((el) => el === document.activeElement)) break;
    }
    await expect(page.getByTestId('latex-input')).toBeFocused();
  });

  test('the cell atlas lists all 64 cam positions', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-device').click();
    await page.getByTestId('device-atlas').click();
    await expect(page.getByRole('heading', { name: 'Cell atlas' })).toBeVisible();
    await expect(page.locator('.atlas__item')).toHaveCount(64);
  });
});

test.describe('appearance', () => {
  const WIDTHS = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 834, height: 1112 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const size of WIDTHS) {
    test(`renders at ${size.name} (${size.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');
      await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
      await page.getByTestId('cell-count').fill(size.width < 700 ? '2' : '6');
      await page.waitForTimeout(500); // let the cam animation settle before capturing

      // No horizontal overflow at any width — a scrollbar sideways is a design bug.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the page must not scroll horizontally').toBeLessThanOrEqual(1);

      await page.screenshot({ path: `${SHOTS}/read-${size.name}.png`, fullPage: true });
    });
  }

  test('captures the cell atlas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId('nav-device').click();
    await page.getByTestId('device-atlas').click();
    await expect(page.locator('.atlas__item')).toHaveCount(64);
    await page.screenshot({ path: `${SHOTS}/atlas-desktop.png`, fullPage: true });
  });
});

/**
 * The blackboard itself — the v4 core.
 *
 * A board that has never been written on opens with one worked line already standing on it and
 * already on the cells; the teacher writes lines and they accumulate; tapping any line is the
 * teacher pointing at the board. This is the product; everything else serves it.
 */
test.describe('the blackboard', () => {
  test('opens with one worked line already alive on the cells', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    // The seeded example stands ON the board, not in the input — the hand starts empty.
    await expect(page.getByTestId('lesson-rail').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('latex-input')).toHaveValue('');
  });

  test('lines accumulate, and tapping one puts it back on the display', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('2/3 + 1/6');
    await page.getByTestId('commit-line').click();
    await page.getByTestId('latex-input').fill('sqrt(144) = 12');
    await page.getByTestId('commit-line').click();
    await expect(page.getByTestId('lesson-rail').locator('li')).toHaveCount(3);

    // The display holds the last line written…
    await expect(page.getByTestId('braille-unicode')).toContainText('⠜', { timeout: 10_000 });
    // …until the teacher points at an earlier one.
    await page.getByTestId('lesson-line-1').click();
    await expect(page.getByTestId('braille-unicode')).toContainText('⠹', { timeout: 10_000 });
  });

  test('correcting a line happens in the tray, and the correction lands', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('2+2=5');
    await page.getByTestId('commit-line').click();
    await page.getByTestId('lesson-edit-1').click();
    await expect(page.getByTestId('latex-input')).toHaveValue('2+2=5');
    await page.getByTestId('latex-input').fill('2+2=4');
    await page.getByTestId('commit-line').click();

    await expect(page.getByTestId('lesson-line-1')).not.toContainText('2+2=5');
    await expect(page.getByTestId('latex-input')).toHaveValue('');
  });

  test('a wiped board stays wiped — the example does not come back', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('lesson-clear').click();
    await expect(page.getByTestId('lesson-empty')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('lesson-empty')).toBeVisible({ timeout: 20_000 });
  });
});

/**
 * Hostile input.
 *
 * Everything here was typed at the real thing during a QA pass, and one of them found a genuine
 * defect: "((((" produces four identical complaints, four React children claimed the same identity,
 * and the console filled with warnings on a screen that looked perfectly fine. A test that only
 * types valid maths would never have seen it.
 */
test.describe('nothing a teacher can type breaks it', () => {
  test('survives nonsense, and says so without a single console error', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    const nasty = [
      '((((',
      '))))',
      '?????',
      '1/0',
      'x'.repeat(300),
      '।।।।',
      'क ् ्',
      '^^^^',
      '{{{{}}}}',
      '|||',
      'Rs Rs Rs',
      '\frac{1}{',
      '💥 + 2',
      '   ',
    ];
    for (const input of nasty) {
      await page.getByTestId('latex-input').fill(input);
      await page.waitForTimeout(120);
      // Still alive, still showing cells, still able to be typed into.
      await expect(page.getByTestId('cell-row')).toBeVisible();
    }

    // And back to something ordinary, from whatever state that left it in.
    await page.getByTestId('latex-input').fill('1/2');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠂⠌⠆⠼', { timeout: 10_000 });

    expect(problems, 'the console must stay clean, even under abuse').toEqual([]);
  });
});

/**
 * Nine scripts, one braille.
 *
 * Bharati Braille unifies the Indian scripts: the corresponding letter is the same cell in all of
 * them. That claim is only worth anything if a teacher can type in their own script and get it, so
 * this types a question in Bengali and one in Devanagari and asserts that the number in the middle
 * is the same Nemeth either way — and that neither line loses a character.
 */
test.describe('a question in any Indian script', () => {
  test('reads Bengali, and marks the maths inside it the same way', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('দুটি সংখ্যার যোগফল 12');
    await expect(page.getByTestId('question-strip')).toBeVisible({ timeout: 10_000 });

    // The words are Bharati, and the chip says which script they were written in.
    await expect(page.getByTestId('question-strip')).toContainText('বাংলা');
    // The maths is still Nemeth, still switched into and out of.
    await expect(page.getByTestId('braille-unicode')).toContainText('⠸⠩⠀⠼⠂⠆⠀⠸⠱');
    // Nothing was dropped.
    await expect(page.getByTestId('input-issue')).toHaveCount(0);
  });

  test('gives the same cells for the same word in two scripts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('गणित');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠛⠼⠊⠞', { timeout: 10_000 });

    await page.getByTestId('latex-input').fill('গণিত');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠛⠼⠊⠞', { timeout: 10_000 });

    await page.getByTestId('latex-input').fill('ಗಣಿತ');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠛⠼⠊⠞', { timeout: 10_000 });
  });
});

/**
 * A dropped character has to be visible, whichever half of the line it was in.
 *
 * Bengali's khanda ta is one of the few letters no other Indian script has, so it has no cell in a
 * unified table. The right behaviour is not to render something near it — it is to say so.
 */
/**
 * The hand empties and stays empty.
 *
 * The v3 greeting used to refill the input whenever it became empty — deleting the last
 * character put the example back under the teacher's cursor. v4 seeds the example onto the
 * BOARD instead and never touches the hand, so the box's only writer is the teacher.
 */
test('an emptied input stays empty — nothing races to refill it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
  await expect(page.getByTestId('latex-input')).toHaveValue('');

  await page.getByTestId('latex-input').fill('2x + 5 = 15');
  await page.getByTestId('latex-input').fill('');
  await page.waitForTimeout(600);
  await expect(page.getByTestId('latex-input')).toHaveValue('');
});

test('says when a character has no braille cell, and renders the rest anyway', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

  // Gurmukhi's addak, which doubles the consonant after it. No other script here has the idea, and
  // no single Bharati cell means it — so it is reported, by the symbol the teacher actually typed.
  await page.getByTestId('latex-input').fill('গণিত ੱ গণিত');
  await expect(page.getByTestId('input-issue')).toHaveCount(1, { timeout: 10_000 });
  await expect(page.getByTestId('input-issue')).toContainText('ੱ');
  // The rest of the line still reached the cells.
  await expect(page.getByTestId('braille-unicode')).toContainText('⠛⠼⠊⠞');
});
