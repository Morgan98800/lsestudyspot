import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { STARTER_ZONES } from '../src/lib/data/starter-zones';
import { generatePosterPdf } from '../src/lib/poster/generator';

async function run() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lsestudyspot.vercel.app';
  const qrPublicDir = path.join(process.cwd(), 'public', 'qr');
  const postersDir = path.join(process.cwd(), 'dist', 'posters');

  if (!fs.existsSync(qrPublicDir)) {
    fs.mkdirSync(qrPublicDir, { recursive: true });
  }
  if (!fs.existsSync(postersDir)) {
    fs.mkdirSync(postersDir, { recursive: true });
  }

  console.log(`Generating QR codes and signage pointing to: ${baseUrl}\n`);

  // 1. Home App QR Code
  const homeQrPath = path.join(qrPublicDir, 'app-home.png');
  await QRCode.toFile(homeQrPath, baseUrl, {
    errorCorrectionLevel: 'H',
    width: 600,
    margin: 2,
    color: {
      dark: '#1B1B1D',
      light: '#FFFFFF',
    },
  });
  console.log(`✓ Generated Home App QR Code: public/qr/app-home.png`);

  // 2. Zone QR Codes (PNG + SVG) & Posters (A5 + A6)
  for (const zone of STARTER_ZONES) {
    const targetUrl = `${baseUrl}/z/${zone.slug}?t=${zone.qr_token}`;

    // PNG image (600x600)
    const pngPath = path.join(qrPublicDir, `${zone.slug}.png`);
    await QRCode.toFile(pngPath, targetUrl, {
      errorCorrectionLevel: 'H',
      width: 600,
      margin: 2,
      color: {
        dark: '#1B1B1D',
        light: '#FFFFFF',
      },
    });

    // SVG vector
    const svgPath = path.join(qrPublicDir, `${zone.slug}.svg`);
    const svgString = await QRCode.toString(targetUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#1B1B1D',
        light: '#FFFFFF',
      },
    });
    fs.writeFileSync(svgPath, svgString, 'utf-8');

    // PDF Posters (A5 wall + A6 stand)
    const pdfA5 = await generatePosterPdf(zone, { size: 'A5', baseUrl });
    fs.writeFileSync(path.join(postersDir, `${zone.slug}_A5_wall.pdf`), pdfA5);

    const pdfA6 = await generatePosterPdf(zone, { size: 'A6', baseUrl });
    fs.writeFileSync(path.join(postersDir, `${zone.slug}_A6_stand.pdf`), pdfA6);

    console.log(`✓ [${zone.name}] -> public/qr/${zone.slug}.png & .svg | dist/posters/${zone.slug}_A5_wall.pdf`);
  }

  // Print ASCII QR for Library Floor 1 to terminal
  const libF1 = STARTER_ZONES[0];
  const sampleUrl = `${baseUrl}/z/${libF1.slug}?t=${libF1.qr_token}`;
  const asciiQr = await QRCode.toString(sampleUrl, { type: 'terminal', small: true });

  console.log(`\n======================================================`);
  console.log(`📱 SCANNABLE QR CODE FOR: ${libF1.name}`);
  console.log(`URL: ${sampleUrl}`);
  console.log(`======================================================\n`);
  console.log(asciiQr);
  console.log(`\n======================================================`);
}

run().catch((err) => {
  console.error('Error generating QR codes:', err);
  process.exit(1);
});
