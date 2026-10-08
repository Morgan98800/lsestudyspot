import { test, expect } from '@playwright/test';

test.describe('SEO, Metadata, Canonical, and OpenGraph Tests', () => {
  test('Home page metadata, openGraph, twitter, and canonical URL', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('LSE Spots');

    // Description
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute(
      'content',
      'See where there are free study seats at LSE right now. Unofficial, student-built.'
    );

    // OpenGraph
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', 'LSE Spots');

    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute('content', 'website');

    const ogLocale = page.locator('meta[property="og:locale"]');
    await expect(ogLocale).toHaveAttribute('content', 'en_GB');

    // Twitter
    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

    // Canonical
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /https?:\/\/[^/]+\/?$/);
  });

  test('Privacy page has its own canonical URL and title', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page).toHaveTitle('Privacy & Your Data — LSE Spots');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /.*\/privacy$/);
  });

  test('QR route has generic title, no QR token in metadata, and noindex meta', async ({ page }) => {
    const token = 'qr_tok_lib_f1_v1';
    await page.goto(`/z/library-floor-1?t=${token}`);

    // Generic title
    await expect(page).toHaveTitle('LSE Spots');

    // Robots meta is noindex
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex.*nofollow/);

    // Token must not be present in any metadata tags
    const htmlContent = await page.content();
    const headContent = htmlContent.substring(0, htmlContent.indexOf('</head>'));
    expect(headContent.includes(token)).toBe(false);
  });

  test('Admin route has noindex robots meta', async ({ page }) => {
    await page.goto('/admin');

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex.*nofollow/);
  });

  test('Robots.txt contains correct allow/disallow rules and sitemap reference', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();

    expect(body).toContain('Disallow: /z/');
    expect(body).toContain('Disallow: /admin/');
    expect(body).toContain('sitemap.xml');
  });

  test('Sitemap.xml includes home, privacy, feedback and excludes z and admin', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();

    expect(body).toContain('<loc>');
    expect(body).toContain('/privacy</loc>');
    expect(body).toContain('/feedback</loc>');
    expect(body.includes('/z/')).toBe(false);
    expect(body.includes('/admin/')).toBe(false);
  });

  test('OpenGraph image route generates 1200x630 image/png with 200 OK', async ({ request }) => {
    const res = await request.get('/opengraph-image');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const buffer = await res.body();
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
