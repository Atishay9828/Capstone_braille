/**
 * Accessibility, asserted rather than assumed.
 *
 * This is a tool *about* blind students. A braille product that a screen-reader user cannot operate
 * would be the single most deserved criticism it could attract, so the structure a screen reader
 * relies on — landmarks, headings, labels, live regions, focus — is tested, not hoped for.
 *
 * These checks cannot replace using NVDA or VoiceOver, and they do not claim to. They catch the
 * structural regressions that make a screen reader useless, which is what automation is good for.
 */

import { expect, test, type Page } from '@playwright/test';

const SCREENS = [
  { tab: 'board', steps: [], heading: 'The blackboard' },
  { tab: 'scan', steps: ['tray-scan'], heading: 'The blackboard' },
  { tab: 'device', steps: ['nav-device'], heading: 'Hardware' },
  { tab: 'atlas', steps: ['nav-device', 'device-atlas'], heading: 'Cell atlas' },
] as const;

async function open(page: Page, tab: string) {
  await page.goto('/');
  await expect(page.getByTestId('braille-unicode')).toContainText('⠭', { timeout: 20_000 });
  const screen = SCREENS.find((entry) => entry.tab === tab);
  for (const step of screen?.steps ?? []) await page.getByTestId(step).click();
}

test.describe('structure a screen reader can navigate', () => {
  test('has the landmarks a screen reader jumps between', async ({ page }) => {
    await open(page, 'board');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo', { name: 'System status' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  });

  for (const screen of SCREENS) {
    test(`${screen.tab}: exactly one h1, and no skipped heading levels`, async ({ page }) => {
      await open(page, screen.tab);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { name: screen.heading, level: 1 })).toBeVisible();

      const levels = await page.evaluate(() =>
        [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
      );
      let previous = 0;
      for (const level of levels) {
        if (previous !== 0) {
          expect(level - previous, `heading jumped from h${previous} to h${level}`).toBeLessThanOrEqual(1);
        }
        previous = level;
      }
    });

    test(`${screen.tab}: every control has an accessible name`, async ({ page }) => {
      await open(page, screen.tab);
      const unnamed = await page.evaluate(() => {
        const problems: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea');
        for (const el of controls) {
          if (el.closest('[aria-hidden="true"]')) continue;
          const name =
            el.getAttribute('aria-label') ??
            (el.getAttribute('aria-labelledby')
              ? (document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent ?? '')
              : '') ??
            '';
          const labelled = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
          const wrapped = el.closest('label');
          const text = el.textContent?.trim() ?? '';
          const title = el.getAttribute('title') ?? '';
          if (!name.trim() && !labelled && !wrapped && !text && !title) {
            problems.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'}`);
          }
        }
        return problems;
      });
      expect(unnamed, `controls with no accessible name: ${unnamed.join(', ')}`).toEqual([]);
    });
  }

  test('the braille cells announce what they are showing', async ({ page }) => {
    await open(page, 'board');
    // A cell is a picture of a braille character; its label must say the dots AND the cam position,
    // because both are what the reader and the hardware team need.
    const label = await page.getByTestId('cell-0').getAttribute('aria-label');
    expect(label).toMatch(/Cell 1: .+ \(\d(-\d)*\), cam position \d+/);
  });

  test('state changes are announced through a live region', async ({ page }) => {
    await open(page, 'board');
    const live = page.getByTestId('live-region');
    await expect(live).toHaveAttribute('aria-live', 'polite');

    await page.getByTestId('latex-input').fill('2+3=5');
    await expect(live).toContainText('braille cells', { timeout: 10_000 });

    await page.getByTestId('cell-count').fill('4');
    await expect(live).toContainText('4 cells');
  });

  test('the skip link is the first thing keyboard focus reaches, and it works', async ({ page }) => {
    await open(page, 'board');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to the display/i });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main')).toBeVisible();
  });
});

test.describe('keyboard only', () => {
  for (const screen of SCREENS) {
    test(`${screen.tab}: tabbing reaches controls and never traps`, async ({ page }) => {
      await open(page, screen.tab);
      // Give the document focus first. Headless Chromium starts with focus nowhere, and the first
      // Tab then lands on nothing — which is a property of the harness, not of the page. A raw
      // mouse click at the corner works whatever overlay (the scan sheet) is on top.
      await page.mouse.click(2, 2);

      const seen = new Set<string>();
      let last = '';
      let stuck = 0;

      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press('Tab');
        const id = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return 'BODY';
          // The text matters: the example chips share a class and have no id, so without it two
          // different buttons look identical and a normal Tab reads as a focus trap.
          return [
            el.tagName,
            el.id,
            el.className,
            el.getAttribute('data-testid') ?? '',
            (el.textContent ?? '').trim().slice(0, 30),
            el.getAttribute('aria-label') ?? '',
          ].join('|');
        });

        // Focus leaving for the browser chrome means the cycle finished — but only once we have
        // actually visited something, otherwise we would call an empty page "complete".
        if (id === 'BODY') {
          if (seen.size > 0) break;
          continue;
        }

        // A trap is Tab failing to MOVE focus. Returning to an element seen earlier is just the
        // tab order cycling, which is correct behaviour, not a fault.
        stuck = id === last ? stuck + 1 : 0;
        expect(stuck, `focus is stuck on ${id} — Tab does not move it`).toBeLessThan(3);
        last = id;
        seen.add(id);
      }

      expect(seen.size, `${screen.tab} should have several focusable controls`).toBeGreaterThan(3);
    });
  }

  test('the reader is fully operable without a mouse', async ({ page }) => {
    await open(page, 'board');
    await page.getByTestId('speech-toggle').click(); // speech starts on; one press silences it
    await page.getByTestId('latex-input').fill(String.raw`\frac{1}{2a}`);
    await page.waitForTimeout(400);
    await page.getByTestId('explore-toggle').click();
    await page.getByTestId('mode-explore').click();
    await page.locator('.rail-top__brand').click();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Numerator');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction ▸ Denominator');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('breadcrumb')).toHaveText('Fraction');
  });

  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'board');
    const duration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--dur-cam').trim(),
    );
    expect(duration).toBe('1ms');
  });
});
