import { test, expect } from '@playwright/test';

test.describe('LSE Spots Exact Smoke Tests', () => {
  test('Home page shows the answer first, with segmented filter and sections', async ({ page }) => {
    await page.goto('/');

    // 1. Header has white wordmark "LSE Spots" and "Unofficial" pill
    const header = page.locator('header');
    await expect(header).toContainText('LSE Spots');
    await expect(header).toContainText('Unofficial');

    // 2. The answer comes first directly under header
    const heroH1 = page.locator('h1').first();
    await expect(heroH1).toBeVisible();
    await expect(heroH1).toHaveText(/spaces have seats|1 space has seats|Everything is full/);

    // 3. Subline
    await expect(page.locator('text=Right now, reported by students.')).toBeVisible();

    // 4. Segmented control with 3 options: All / Quiet / Group
    const filterTabs = page.locator('[role="tab"]');
    await expect(filterTabs).toHaveCount(3);
    await expect(filterTabs.nth(0)).toHaveText('All');
    await expect(filterTabs.nth(1)).toHaveText('Quiet');
    await expect(filterTabs.nth(2)).toHaveText('Group');

    // Verify NO search bar or dropdowns exist on home
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
    await expect(page.locator('select')).toHaveCount(0);

    // 5. Footer disclaimer
    await expect(page.locator('footer')).toContainText(
      'Student-built, not affiliated with LSE. Estimates only.'
    );
  });

  test('Segmented control filters list by Quiet and Group', async ({ page }) => {
    await page.goto('/');

    // Tap "Quiet"
    await page.getByRole('tab', { name: 'Quiet' }).click();
    await expect(page.getByRole('tab', { name: 'Quiet' })).toHaveClass(/bg-\[var\(--brand\)\]/);

    // Tap "Group"
    await page.getByRole('tab', { name: 'Group' }).click();
    await expect(page.getByRole('tab', { name: 'Group' })).toHaveClass(/bg-\[var\(--brand\)\]/);

    // Tap "All"
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByRole('tab', { name: 'All' })).toHaveClass(/bg-\[var\(--brand\)\]/);
  });

  test('Accordion expands inline to reveal attributes, insight, and hourly chart', async ({ page }) => {
    await page.goto('/');

    // Find the first space row button
    const firstRowButton = page.locator('button[aria-expanded]').first();
    await expect(firstRowButton).toBeVisible();
    await expect(firstRowButton).toHaveAttribute('aria-expanded', 'false');

    // Tap to expand
    await firstRowButton.click();
    await expect(firstRowButton).toHaveAttribute('aria-expanded', 'true');

    // Check that hourly chart is visible
    const chart = page.locator('[role="img"][aria-label*="Hourly busyness chart"]');
    await expect(chart.first()).toBeVisible();

    // Check correction text
    await expect(
      page.locator('text=Looks wrong? Scan the QR code at the spot to correct it.').first()
    ).toBeVisible();
  });

  test('QR Report flow: 1-tap submission -> thank you -> returns to home with updated status', async ({
    page,
  }) => {
    // Navigate with valid token for Library floor 1
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');

    await expect(page.locator('h1')).toContainText('Library, floor 1');
    await expect(page.locator('text=How busy is it?')).toBeVisible();

    // 3 huge buttons >= 96px tall
    const plentyButton = page.getByRole('button', { name: /Plenty of seats/i });
    await expect(plentyButton).toBeVisible();

    // Submit report with one tap
    await plentyButton.click();

    // Thank you screen
    await expect(page.locator('text=Thanks!')).toBeVisible();
    await expect(page.locator('text=You said Library, floor 1 is Plenty of seats.')).toBeVisible();

    // Click "See free spaces"
    await page.getByRole('link', { name: 'See free spaces' }).click();

    // Returns to home
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Library, floor 1')).toBeVisible();
  });

  test('QR Report flow: rate limit error when reporting again within 10 minutes', async ({ page }) => {
    // Navigate with valid token that was just submitted
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');

    // Should show rate limit message
    await expect(page.locator('text=You already reported here')).toBeVisible();
    await expect(page.locator('text=You can report again in')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See free spaces' })).toBeVisible();
  });

  test('QR Report flow: invalid token shows friendly out of date message', async ({ page }) => {
    await page.goto('/z/library-floor-1?t=expired_wrong_token');

    await expect(page.locator('text=This code is out of date')).toBeVisible();
    await expect(
      page.locator('text=Ask the library desk, or open the app to find the space you are in.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible();
  });
});
