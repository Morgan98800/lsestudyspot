import { test, expect } from '@playwright/test';

test.describe('LSE Spots Exact Smoke Tests (v2)', () => {
  test.beforeEach(async ({ context }) => {
    // Set mock daytime (Wednesday 13:00 London time) so zones are deterministically open during tests
    await context.addCookies([
      {
        name: 'mock_now',
        value: '2026-10-07T13:00:00Z',
        url: 'http://localhost:3000',
      },
    ]);
  });

  test('Home page shows the answer first, recommendation card, List/Map switch, and Quiet only button', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Header has white wordmark "LSE Spots", "Unofficial" pill, and search magnifier
    const header = page.locator('header');
    await expect(header).toContainText('LSE Spots');
    await expect(header).toContainText('Unofficial');
    const searchBtn = header.locator('button[aria-label="Search buildings and floors"]');
    await expect(searchBtn).toBeVisible();

    // 2. The answer comes first directly under header
    const heroH1 = page.locator('h1').first();
    await expect(heroH1).toBeVisible();
    await expect(heroH1).toHaveText(/spaces have seats|1 space has seats|Everything is full/);

    // 3. Subline
    await expect(page.locator('text=Right now, reported by students.')).toBeVisible();

    // 4. Recommendation card ("Try <space>")
    const recHeading = page.locator('h2', { hasText: /^Try / });
    if (await recHeading.count() > 0) {
      await expect(recHeading).toBeVisible();
    }

    // 5. List / Map switch and Quiet only button
    const viewTabs = page.locator('[role="tab"]');
    await expect(viewTabs).toHaveCount(2);
    await expect(viewTabs.nth(0)).toContainText('List');
    await expect(viewTabs.nth(1)).toContainText('Map');

    const quietBtn = page.getByRole('button', { name: 'Quiet only' });
    await expect(quietBtn).toBeVisible();
    await expect(quietBtn).toHaveAttribute('aria-pressed', 'false');

    // 6. Footer disclaimer
    await expect(page.locator('footer')).toContainText(
      'Student-built, not affiliated with LSE. Estimates only.'
    );
  });

  test('Search: opens from header icon, shows buildings list when empty, matches keywords, and cancels', async ({
    page,
  }) => {
    await page.goto('/');

    // Tap search icon in header
    await page.locator('button[aria-label="Search buildings and floors"]').click();

    // Search input is visible and focused
    const searchInput = page.getByPlaceholder('Search a building or floor');
    await expect(searchInput).toBeVisible();

    // With empty query, shows Buildings directory
    await expect(page.locator('h2', { hasText: 'Buildings' })).toBeVisible();
    await expect(page.locator('text=Lionel Robbins Building')).toBeVisible();

    // Type "marshall"
    await searchInput.fill('marshall');
    await expect(page.locator('text=Marshall atrium')).toBeVisible();

    // Cancel returns to home page
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(searchInput).toHaveCount(0);
    await expect(page.locator('text=Right now, reported by students.')).toBeVisible();
  });

  test('Map switch toggles between List and Campus Map with building status tiles', async ({
    page,
  }) => {
    await page.goto('/');

    // Switch to Map
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');

    // Map container and gradient legend bar are visible
    const gradientBar = page.locator('[role="img"][aria-label*="Colour scale from plenty of seats to full"]');
    await expect(gradientBar).toBeVisible();
    await expect(page.getByText('Plenty of seats', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Full', { exact: true }).first()).toBeVisible();

    // Switch back to List
    await page.getByRole('tab', { name: 'List' }).click();
    await expect(page.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Quiet only button toggles and updates aria-pressed', async ({ page }) => {
    await page.goto('/');

    const quietBtn = page.getByRole('button', { name: 'Quiet only' });
    await expect(quietBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggle on
    await quietBtn.click();
    await expect(quietBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle off
    await quietBtn.click();
    await expect(quietBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('Accordion expands inline to reveal insight and 14-bar hourly chart', async ({
    page,
  }) => {
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
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');

    await expect(page.locator('h1')).toContainText('Library, floor 1');
    await expect(page.locator('text=How busy is it?')).toBeVisible();

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
    await expect(page.locator('text=Library, floor 1').first()).toBeVisible();
  });

  test('QR Report flow: rate limit error when reporting again within 10 minutes', async ({
    page,
  }) => {
    // 1. Submit report for Library floor 2
    await page.goto('/z/library-floor-2?t=qr_tok_lib_f2_v1');
    const plentyButton = page.getByRole('button', { name: /Plenty of seats/i });
    await plentyButton.click();
    await expect(page.locator('text=Thanks!')).toBeVisible();

    // 2. Reload the page and attempt to submit again immediately
    await page.goto('/z/library-floor-2?t=qr_tok_lib_f2_v1');
    await page.getByRole('button', { name: /Plenty of seats/i }).click();

    // 3. Should show rate limit message
    await expect(page.locator('text=You already reported here')).toBeVisible();
    await expect(page.locator('text=You can report again in')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See free spaces' })).toBeVisible();
  });

  test('QR Report flow: invalid token shows friendly out of date message', async ({
    page,
  }) => {
    await page.goto('/z/library-floor-1?t=expired_wrong_token');

    await expect(page.locator('text=This code is out of date')).toBeVisible();
    await expect(
      page.locator('text=Ask the library desk, or open the app to find the space you are in.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible();
  });
});
