import { test, expect } from '@playwright/test';

test.describe('PWA Install-to-Home-Screen Prompt E2E Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'mock_now',
        value: '2026-10-07T13:00:00Z',
        url: 'http://localhost:3000',
      },
    ]);
  });

  test('Not shown on first visit to home page', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1').first()).toBeVisible();

    // Banner should NOT be visible on first visit
    const banner = page.getByRole('region', { name: 'Install app banner' });
    await expect(banner).toHaveCount(0);
  });

  test('Shown on 3rd distinct visit day, and dismissal persists for 30 days', async ({ page }) => {
    // Prime localStorage with 2 prior visit days
    await page.addInitScript(() => {
      localStorage.setItem('lse_pwa_visit_days', JSON.stringify(['2026-10-05', '2026-10-06']));
    });

    await page.goto('/');

    const banner = page.getByRole('region', { name: 'Install app banner' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Open LSE Spots faster');
    await expect(banner).toContainText('Add it to your home screen.');

    // Click close 'X' button
    const closeBtn = banner.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Immediately hidden
    await expect(banner).toHaveCount(0);

    // Reload page to verify dismissal persists
    await page.reload();
    await expect(page.getByRole('region', { name: 'Install app banner' })).toHaveCount(0);
  });

  test('Not shown on QR page before reporting, but shown on thank-you screen', async ({ page }) => {
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');

    // Before submit: neither banner nor install link should be visible
    await expect(page.getByRole('region', { name: 'Install app banner' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to home screen' })).toHaveCount(0);

    // Submit report
    const plentyButton = page.getByRole('button', { name: /Plenty of seats/i });
    await plentyButton.click();

    // On thank you screen: quiet text link "Add to home screen" appears
    await expect(page.locator('text=Thanks!')).toBeVisible();
    const installLink = page.getByRole('button', { name: 'Add to home screen' });
    await expect(installLink).toBeVisible();

    // Click install link to see instructions
    await installLink.click();
    await expect(
      page.locator("text=/Tap the Share button|Tap browser menu/")
    ).toBeVisible();
  });
});
