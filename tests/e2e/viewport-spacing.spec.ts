import { test, expect } from '@playwright/test';

test.describe('Bottom spacing & viewport tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'mock_now',
        value: '2026-10-07T13:00:00Z',
        url: 'http://localhost:3000',
      },
    ]);
  });

  test('Home page: footer text is at least 80px above viewport bottom when scrolled to bottom', async ({
    page,
  }, testInfo) => {
    await page.goto('/');

    // Wait for content to load
    await expect(page.locator('h1').first()).toBeVisible();

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    // Small pause to let scroll settle
    await page.waitForTimeout(150);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const box = await footer.boundingBox();
    expect(box).not.toBeNull();

    const viewportHeight = page.viewportSize()!.height;
    const distanceFromBottom = viewportHeight - (box!.y + box!.height);

    // Footer text bottom must be at least 80px above viewport bottom
    expect(distanceFromBottom).toBeGreaterThanOrEqual(80);

    const projectName = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await page.screenshot({
      path: `test-results/home-footer-${projectName}.png`,
    });
  });

  test('QR page: all three buttons and "No sign-up" are fully inside the viewport without scrolling', async ({
    page,
  }, testInfo) => {
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');

    const viewportHeight = page.viewportSize()!.height;

    // Verify page title
    await expect(page.locator('h1')).toContainText('Library, floor 1');

    // Verify all 3 buttons are visible and inside viewport
    const buttons = [
      page.getByRole('button', { name: /Plenty of seats/i }),
      page.getByRole('button', { name: /Filling up/i }),
      page.getByRole('button', { name: /Full/i }),
    ];

    for (const btn of buttons) {
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
    }

    // Verify "No sign-up" line is also inside viewport
    const noSignUp = page.locator('text=No sign-up. Takes 3 seconds.');
    await expect(noSignUp).toBeVisible();
    const noSignUpBox = await noSignUp.boundingBox();
    expect(noSignUpBox).not.toBeNull();
    expect(noSignUpBox!.y + noSignUpBox!.height).toBeLessThanOrEqual(viewportHeight);

    const projectName = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await page.screenshot({
      path: `test-results/qr-buttons-${projectName}.png`,
    });
  });
});
