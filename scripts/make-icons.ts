import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const ICONS_DIR = path.resolve(process.cwd(), 'public/icons');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const APP_DIR = path.resolve(process.cwd(), 'src/app');

// Master SVG templates
const STANDARD_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#E4002B"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <path d="M196 148 C196 134 208 122 224 122 L288 122 C304 122 316 134 316 148 L316 270 L196 270 Z" fill="#FFFFFF"/>
    <rect x="164" y="282" width="184" height="34" rx="14" fill="#FFFFFF"/>
    <path d="M196 322 L176 394"/>
    <path d="M316 322 L336 394"/>
    <path d="M184 364 L328 364" stroke-width="20"/>
  </g>
</svg>
`.trim();

const MASKABLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Full bleed background for maskable safe area -->
  <rect width="512" height="512" fill="#E4002B"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <path d="M196 148 C196 134 208 122 224 122 L288 122 C304 122 316 134 316 148 L316 270 L196 270 Z" fill="#FFFFFF"/>
    <rect x="164" y="282" width="184" height="34" rx="14" fill="#FFFFFF"/>
    <path d="M196 322 L176 394"/>
    <path d="M316 322 L336 394"/>
    <path d="M184 364 L328 364" stroke-width="20"/>
  </g>
</svg>
`.trim();

async function generateIcons() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Save SVG source files
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), STANDARD_SVG);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable.svg'), MASKABLE_SVG);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.svg'), STANDARD_SVG);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.svg'), STANDARD_SVG);

  console.log('Generating PNG icons via Chromium headless renderer...');
  const browser = await chromium.launch();

  const renderPng = async (svgContent: string, width: number, height: number, outputPath: string) => {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
            svg { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;

    await page.setContent(html);
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    fs.writeFileSync(outputPath, buffer);
    await page.close();
    console.log(`✓ Generated ${outputPath} (${width}x${height})`);
  };

  // 192x192 standard icon
  await renderPng(STANDARD_SVG, 192, 192, path.join(ICONS_DIR, 'icon-192.png'));

  // 512x512 standard icon
  await renderPng(STANDARD_SVG, 512, 512, path.join(ICONS_DIR, 'icon-512.png'));

  // 512x512 maskable icon
  await renderPng(MASKABLE_SVG, 512, 512, path.join(ICONS_DIR, 'icon-maskable-512.png'));

  // 180x180 apple touch icon
  await renderPng(STANDARD_SVG, 180, 180, path.join(ICONS_DIR, 'apple-touch-icon.png'));
  await renderPng(STANDARD_SVG, 180, 180, path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // Favicon (48x48 PNG)
  await renderPng(STANDARD_SVG, 48, 48, path.join(PUBLIC_DIR, 'favicon.ico'));
  if (fs.existsSync(APP_DIR)) {
    await renderPng(STANDARD_SVG, 48, 48, path.join(APP_DIR, 'favicon.ico'));
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
