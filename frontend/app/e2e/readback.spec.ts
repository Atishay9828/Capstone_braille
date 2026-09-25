/**
 * The check a teacher can make, walked headlessly.
 *
 * The claim on the Board screen is a strong one: that the dots on the display have been read back
 * by a second engine and say the same thing that was typed. A claim like that is worth having only
 * if it is *falsifiable* — so these tests check all three verdicts, including the two nobody wants
 * to see, and check that a question with words in it is checked in every braille code on the line.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

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

async function type(page: Page, text: string) {
  await page.getByTestId('latex-input').fill(text);
  await expect(page.getByTestId('braille-unicode')).not.toBeEmpty();
}

test.describe('reading the dots back', () => {
  test('says what the braille on the display means, in ordinary maths', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await type(page, '(-b +- sqrt(b^2 - 4ac))/(2a)');
    await expect(page.getByTestId('readback-reading')).toHaveText('(-b±√(b^(2)-4ac))/(2a)');
    await expect(page.getByTestId('readback-verdict')).toHaveAttribute('data-verdict', 'agrees');

    await page.getByTestId('readback-reading').screenshot({ path: `${SHOTS}/readback-agrees.png` });
    expect(problems, `console problems:\n${problems.join('\n')}`).toEqual([]);
  });

  test('the reading comes from the cells, not from the input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    // Typed one way, read back another: the reading is in the canonical form the second engine
    // produces, which is not what anybody typed. If it were echoing the input, it would say `1/2`.
    await type(page, '1/2');
    await expect(page.getByTestId('readback-reading')).toHaveText('(1)/(2)');
    await expect(page.getByTestId('braille-unicode')).toHaveText('⠹⠂⠌⠆⠼');
  });

  test('refuses to claim a verdict it cannot support', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    // A vector. The braille engine handles it; the checker does not know an arrow over a letter
    // yet, and the only honest thing to say about that is so.
    await type(page, '\\vec{v}');
    await expect(page.getByTestId('readback-verdict')).toHaveAttribute('data-verdict', 'unchecked');
    await expect(page.getByText(/could not be double-checked/)).toBeVisible();
    // The braille is still there. An unverified translation is not a blanked display (Law 4).
    await expect(page.getByTestId('braille-unicode')).not.toBeEmpty();
  });

  test('checks the words as well as the maths, in every script', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    // Two braille codes on one line — Bharati for the words, Nemeth for the number — and each has
    // its own reader. The verdict covers the whole question or it is not a verdict.
    await type(page, 'दो संख्याओं का योग 12 है');
    await expect(page.getByTestId('readback-verdict')).toHaveAttribute('data-verdict', 'agrees');
    await expect(page.getByTestId('readback-reading')).toContainText('संख्याओं');
    await expect(page.getByTestId('readback-reading')).toContainText('12');

    // A Bengali question reads back as Devanagari, because that is what the cells carry: Bharati is
    // one code for nine scripts, and a ক leaves no trace of its Bengali-ness in the dots.
    await type(page, 'দুটি সংখ্যার যোগফল 12');
    await expect(page.getByTestId('readback-verdict')).toHaveAttribute('data-verdict', 'agrees');

    // And an English word problem, whose words are Grade-1 braille rather than Bharati.
    await type(page, 'Find the value of 2x + 5 = 15');
    await expect(page.getByTestId('readback-verdict')).toHaveAttribute('data-verdict', 'agrees');
    // Capitals survive: Grade-1 braille writes the capital sign, and the reader reads it.
    await expect(page.getByTestId('readback-reading')).toContainText('Find the value of');
  });

  test('speaks the teacher’s language, like everything else on the screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await type(page, 'x^2 + 1');
    await page.getByRole('button', { name: /हिन्दी/ }).click();
    await expect(page.getByText('डॉट्स वही पढ़ते हैं जो आपने लिखा।')).toBeVisible();
    // The braille itself never changes with the language. Nemeth is Nemeth.
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭');
  });

  test('the evidence table names the code each cell is really in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await type(page, 'दो संख्याओं का योग 12 है');
    // The evidence lives behind one press now (v4): a lesson is not an inspection.
    await page.getByTestId('evidence-toggle').click();

    // The strip used to say "Nemeth" whatever was on it, and annotate a Bharati ⠙ as "letter d".
    // A teacher reading that table would have been told something false about every cell.
    const table = page.locator('.wire tbody');
    await expect(page.locator('.evidence__count')).toContainText('Bharati');
    await expect(page.locator('.evidence__count')).toContainText('Nemeth');
    await expect(table.locator('tr').first()).toContainText('द');
    await expect(table).not.toContainText('letter d');

    // And back to pure mathematics: one code, and the Nemeth meanings return.
    await type(page, 'x^2 + 1');
    await expect(page.locator('.evidence__count')).toContainText('Nemeth');
    await expect(page.locator('.evidence__count')).not.toContainText('Bharati');
    await expect(table).toContainText('letter x');
  });

});
