/**
 * The spoken transcript.
 *
 * Braillix speaks maths in English and Hindi, but a Windows machine without the Hindi language pack
 * has no Hindi voice — which is true of the laptop this was built on, and quite possibly of the one
 * it will be demonstrated on. Showing the transcript means the capability is visible and provable
 * either way, and a sighted teacher can see what the student is hearing.
 */

import { expect, test, type Page } from '@playwright/test';

async function openReader(page: Page, latex: string) {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
  await page.getByTestId('speech-toggle').click();
  await page.getByTestId('latex-input').fill(latex);
  await expect(page.getByTestId('latex-input')).toHaveValue(latex);
  await page.waitForTimeout(500);
  await page.getByTestId('explore-toggle').click();
  await page.getByTestId('mode-explore').click();
  await expect(page.getByTestId('breadcrumb')).not.toHaveText('—', { timeout: 10_000 });
}

test.describe('what the student hears', () => {
  test('shows the English transcript, even with speech switched off', async ({ page }) => {
    await openReader(page, 'x^2 + 1');
    await expect(page.getByTestId('spoken-text')).toContainText('squared', { timeout: 10_000 });
  });

  test('shows the Hindi transcript, whether or not a Hindi voice is installed', async ({ page }) => {
    await openReader(page, 'x^2 + 1');
    await page.getByTestId('lang-hi').click();
    // Re-render the current node in the new language.
    await page.getByTestId('go-in').click();
    // वर्ग = "squared". If this appears, the Hindi maths engine is genuinely working.
    await expect(page.getByTestId('spoken-text')).toContainText('वर्ग', { timeout: 10_000 });
  });

  test('the transcript follows the reader as it moves', async ({ page }) => {
    await openReader(page, String.raw`\frac{1}{2a}`);
    const spoken = page.getByTestId('spoken-text');
    await expect(spoken).toContainText('raction', { timeout: 10_000 });

    await page.getByTestId('go-in').click();
    await page.getByTestId('go-next').click();
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Denominator');
    await expect(spoken).not.toContainText('raction');
  });

  test('recognition reports itself correctly at startup, without opening its screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
    const strip = page.getByRole('contentinfo', { name: 'System status' });
    // Either state is legitimate — what matters is that it reflects the disk, not a guess, and
    // that it always offers a fix when it is not ready.
    const badge = strip.locator('.cap', { hasText: 'Recognition' });
    await expect(badge).toBeVisible();
    // Read the state span, not the whole badge: 'off' is a substring of 'offline', which is exactly
    // the sort of sloppy assertion that passes for the wrong reason.
    const state = (await badge.locator('.cap__state').textContent())?.trim();
    expect(['ready', 'off']).toContain(state);
    if (state === 'off') {
      await expect(badge.locator('.cap__fix')).toContainText('fetch:model');
    } else {
      await expect(badge.locator('.cap__reason')).toContainText('on this device');
    }
  });
});

/**
 * A question read aloud.
 *
 * "Say it" used to be silent on exactly the lines a class most wants to hear — a question with
 * words in it has no expression tree to walk, so there was nothing for the maths engine to speak.
 * Now the words are spoken as words and the maths inside them as mathematics, each in its own
 * language, and the transcript on screen shows both halves whether or not this machine has the
 * voices to say them.
 */
test.describe('reading a question aloud', () => {
  test('says the words and the maths, and shows the transcript of both', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });

    await page.getByTestId('latex-input').fill('वृत्त का क्षेत्रफल pi r^2 है');
    await expect(page.getByTestId('question-strip')).toBeVisible({ timeout: 10_000 });

    // What each utterance would be, without needing a voice installed on the machine.
    const said = await page.evaluate(async () => {
      const spoken: { text: string; lang: string }[] = [];
      const original = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
        spoken.push({ text: utterance.text, lang: utterance.lang });
      };
      (window as unknown as { __braillix: { getState: () => { sayCurrent: () => void } } }).__braillix
        .getState()
        .sayCurrent();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      window.speechSynthesis.speak = original;
      return spoken;
    });

    expect(said.length, 'each part is its own utterance').toBeGreaterThanOrEqual(2);
    // The Hindi words go to a Hindi voice even though the interface is in English.
    expect(said.some((part) => part.lang.startsWith('hi') && part.text.includes('क्षेत्रफल'))).toBe(true);
    // And the maths is spoken as mathematics, not read out as characters.
    expect(said.some((part) => /squared/i.test(part.text))).toBe(true);
  });
});
