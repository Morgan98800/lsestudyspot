import { test, expect } from '@playwright/test';

test.describe('404, Error and Offline pages', () => {
  test('Unknown route returns HTTP 404 and renders friendly not found page', async ({
    page,
  }) => {
    const response = await page.goto('/unknown-page-path-12345');
    expect(response?.status()).toBe(404);

    await expect(page.locator('h1')).toHaveText("We can't find that page");
    await expect(page.locator('text=The link may be old or mistyped.')).toBeVisible();

    const seeFreeSpacesLink = page.getByRole('link', { name: 'See free spaces' });
    await expect(seeFreeSpacesLink).toBeVisible();

    const sendFeedbackLink = page.getByRole('link', { name: 'Send feedback' });
    await expect(sendFeedbackLink).toBeVisible();

    // Clicking "See free spaces" returns home
    await seeFreeSpacesLink.click();
    await expect(page).toHaveURL('/');
  });

  test('Thrown error renders friendly error boundary without exposing stack traces', async ({
    page,
  }) => {
    // Listen for uncaught error on page
    page.on('pageerror', () => {
      // Expected since the test page throws an intentional error
    });

    await page.goto('/test-error');

    await expect(page.locator('h1')).toHaveText('Something went wrong');
    await expect(page.locator("text=It's not you. Try again in a moment.")).toBeVisible();

    // Verify error boundary does not expose error stack trace in UI
    await expect(page.locator('main')).not.toContainText('Simulated test error');
    await expect(page.locator('main')).not.toContainText('Error:');

    const tryAgainBtn = page.getByRole('button', { name: 'Try again' });
    await expect(tryAgainBtn).toBeVisible();

    const seeFreeSpacesBtn = page.getByRole('link', { name: 'See free spaces' });
    await expect(seeFreeSpacesBtn).toBeVisible();

    await seeFreeSpacesBtn.click();
    await expect(page).toHaveURL('/');
  });

  test('/offline page renders friendly message and action button', async ({
    page,
  }) => {
    await page.goto('/offline');

    await expect(page.locator('h1')).toHaveText("You're offline");
    await expect(page.locator('text=Connect to the internet to see free spaces.')).toBeVisible();

    const seeSpaces = page.getByRole('link', { name: 'See free spaces' });
    await expect(seeSpaces).toBeVisible();
    await seeSpaces.click();
    await expect(page).toHaveURL('/');
  });
});
