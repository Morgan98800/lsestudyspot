import { test, expect } from '@playwright/test';
import { APP_CONFIG } from '../../src/lib/config/env';

test.describe('Task 1: Feedback Page & Admin Management E2E', () => {
  test.beforeEach(async ({ context }) => {
    // Set mock daytime so zones are deterministically open during tests
    await context.addCookies([
      {
        name: 'mock_now',
        value: '2026-10-07T13:00:00Z',
        url: 'http://localhost:3000',
      },
    ]);
  });

  test('Footer links to feedback from home, 404, and QR thank-you screen', async ({ page }) => {
    // 1. Home page footer
    await page.goto('/');
    const homeFeedbackLink = page.locator('footer').getByRole('link', { name: 'Send feedback' });
    await expect(homeFeedbackLink).toBeVisible();
    await homeFeedbackLink.click();
    await expect(page).toHaveURL(/\/feedback/);
    await expect(page.locator('h1')).toContainText("Tell us what's wrong or missing");

    // 2. 404 page
    await page.goto('/some-nonexistent-page-xyz');
    const notFoundFeedbackLink = page.getByRole('link', { name: 'Send feedback' });
    await expect(notFoundFeedbackLink).toBeVisible();
    await notFoundFeedbackLink.click();
    await expect(page).toHaveURL(/\/feedback\?from=.*404/);
    await expect(page.locator('h1')).toContainText("Tell us what's wrong or missing");

    // 3. QR Thank-you screen
    await page.goto('/z/library-floor-1?t=qr_tok_lib_f1_v1');
    // Prior to submission, no feedback link exists (only 3 buttons)
    await expect(page.getByRole('link', { name: 'Send feedback' })).toHaveCount(0);

    // Submit report
    await page.getByRole('button', { name: /Plenty of seats/i }).click();
    await expect(page.locator('text=Thanks!')).toBeVisible();

    // After submission, feedback link is present
    const qrFeedbackLink = page.getByRole('link', { name: 'Send feedback' });
    await expect(qrFeedbackLink).toBeVisible();
    await qrFeedbackLink.click();
    await expect(page).toHaveURL(/\/feedback\?from=.*library-floor-1/);
    await expect(page.locator('h1')).toContainText("Tell us what's wrong or missing");
  });

  test('Feedback form: choice buttons, live character counter, inline validation, and success flow', async ({
    page,
  }) => {
    await page.goto('/feedback');

    // 1. Heading and subline
    await expect(page.locator('h1')).toContainText("Tell us what's wrong or missing");
    await expect(page.locator('text=We read every message.')).toBeVisible();

    // 2. Choice buttons (all >= 56px height)
    const wrongBtn = page.getByRole('button', { name: 'Something is wrong' });
    const ideaBtn = page.getByRole('button', { name: 'I have an idea' });
    const otherBtn = page.getByRole('button', { name: 'Something else' });

    await expect(wrongBtn).toBeVisible();
    await expect(ideaBtn).toBeVisible();
    await expect(otherBtn).toBeVisible();

    const box = await wrongBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(56);

    // Test selection and helper text
    await ideaBtn.click();
    await expect(page.locator('text=What would make LSE Spots better?')).toBeVisible();

    await otherBtn.click();
    await expect(page.locator("text=What's on your mind?")).toBeVisible();

    await wrongBtn.click();
    await expect(page.locator('text=Which space, and what did you see?')).toBeVisible();

    // 3. Live character counter & validation
    const textarea = page.getByLabel(/What happened\?/i);
    await expect(textarea).toBeVisible();
    await expect(page.locator('text=0/500 characters')).toBeVisible();

    // Type 5 characters
    await textarea.fill('Short');
    await expect(page.locator('text=5/500 characters')).toBeVisible();

    // Tap Send
    await page.getByRole('button', { name: 'Send' }).click();

    // Inline error appears and textarea is focused
    await expect(page.locator('text=Please write at least 10 characters.')).toBeVisible();
    await expect(textarea).toBeFocused();

    // 4. Fill valid feedback message and optional email
    const uniqueMsg = `Playwright E2E feedback test message ${Date.now()}`;
    await textarea.fill(uniqueMsg);
    await expect(page.locator(`text=${uniqueMsg.length}/500 characters`)).toBeVisible();

    const emailInput = page.getByLabel(/Your email/i);
    await emailInput.fill('playwright-student@lse.ac.uk');

    // 5. Submit form
    await page.getByRole('button', { name: 'Send' }).click();

    // 6. Success screen
    await expect(page.locator('text=Thanks, we read every message.')).toBeVisible();
    const seeFreeSpacesLink = page.getByRole('link', { name: 'See free spaces' });
    await expect(seeFreeSpacesLink).toBeVisible();

    // Click "See free spaces" returns home
    await seeFreeSpacesLink.click();
    await expect(page).toHaveURL('/');
  });

  test('Admin feedback dashboard: view submitted feedback, mailto link, and status actions', async ({
    page,
  }) => {
    // 1. Submit a feedback item with unique device id to avoid hitting rate limits
    const testMsg = `Admin test feedback item ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const uniqueDeviceId = `playwright-dev-${Date.now()}-${Math.random()}`;

    const createRes = await page.request.post('http://localhost:3000/api/feedback', {
      data: {
        kind: 'wrong',
        message: testMsg,
        email: 'testadmin@lse.ac.uk',
        from: '/privacy',
        deviceId: uniqueDeviceId,
      },
    });
    expect(createRes.status()).toBe(200);

    // 2. Go to /admin/feedback
    await page.goto('/admin/feedback');

    // Unlock admin panel if password prompt is shown
    const secretInput = page.getByPlaceholder('Admin secret');
    if (await secretInput.isVisible()) {
      await secretInput.fill(APP_CONFIG.adminSecret);
      await page.getByRole('button', { name: 'Unlock admin panel' }).click();
    }

    // Admin feedback panel is visible
    await expect(page.locator('h1')).toContainText('User Feedback');

    // Locate the container row for this feedback item
    const feedbackCard = page.locator('article', { hasText: testMsg });
    await expect(feedbackCard).toBeVisible();

    // Verify mailto link inside this feedback row
    const mailLink = feedbackCard.locator('a[href^="mailto:testadmin@lse.ac.uk"]');
    await expect(mailLink).toBeVisible();

    // Mark seen
    const markSeenBtn = feedbackCard.getByRole('button', { name: 'Mark seen' });
    await expect(markSeenBtn).toBeVisible();
    await markSeenBtn.click();

    // Status badge transitions to Seen
    await expect(feedbackCard.locator('text=Seen')).toBeVisible();

    // Mark done
    const markDoneBtn = feedbackCard.getByRole('button', { name: 'Mark done' });
    await expect(markDoneBtn).toBeVisible();
    await markDoneBtn.click();
    await expect(feedbackCard.locator('text=Done')).toBeVisible();

    // Navigation count updates and tab navigation exists
    await expect(page.getByRole('button', { name: /^Done \(\d+\)$/ })).toBeVisible();
  });
});
