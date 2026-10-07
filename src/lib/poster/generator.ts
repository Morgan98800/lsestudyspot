import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { Zone } from '@/types/database';

export interface PosterOptions {
  size: 'A5' | 'A6';
  baseUrl?: string;
}

export async function generatePosterPdf(
  zone: Zone,
  options: PosterOptions = { size: 'A5' }
): Promise<Uint8Array> {
  const isA6 = options.size === 'A6';
  // A5: 420 x 595 pt (148 x 210 mm)
  // A6: 298 x 420 pt (105 x 148 mm)
  const pageWidth = isA6 ? 298 : 420;
  const pageHeight = isA6 ? 420 : 595;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = isA6 ? 14 : 20;

  // Outer border
  page.drawRectangle({
    x: margin,
    y: margin,
    width: pageWidth - margin * 2,
    height: pageHeight - margin * 2,
    borderColor: rgb(0.85, 0.84, 0.82), // line color
    borderWidth: 1.5,
    color: rgb(0.965, 0.961, 0.953), // bg #F6F5F3
  });

  // Top header banner in brand red #E4002B
  const headerHeight = isA6 ? 44 : 56;
  page.drawRectangle({
    x: margin,
    y: pageHeight - margin - headerHeight,
    width: pageWidth - margin * 2,
    height: headerHeight,
    color: rgb(0.894, 0, 0.169), // LSE brand red #E4002B
  });

  // Title in header
  const titleText = 'LSE Spots';
  const titleSize = isA6 ? 16 : 20;
  page.drawText(titleText, {
    x: margin + 14,
    y: pageHeight - margin - (isA6 ? 28 : 36),
    size: titleSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Unofficial pill on the right
  const pillText = 'Unofficial';
  const pillSize = isA6 ? 8 : 10;
  const pillWidth = fontBold.widthOfTextAtSize(pillText, pillSize);
  page.drawText(pillText, {
    x: pageWidth - margin - pillWidth - 14,
    y: pageHeight - margin - (isA6 ? 25 : 33),
    size: pillSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Space Name (Large heading)
  let currentY = pageHeight - margin - headerHeight - (isA6 ? 28 : 38);
  const zoneName = zone.name;
  const zoneSize = isA6 ? 18 : 24;
  const zoneWidth = fontBold.widthOfTextAtSize(zoneName, zoneSize);
  page.drawText(zoneName, {
    x: (pageWidth - zoneWidth) / 2,
    y: currentY,
    size: zoneSize,
    font: fontBold,
    color: rgb(0.106, 0.106, 0.114), // ink #1B1B1D
  });

  // Descriptor
  currentY -= isA6 ? 14 : 18;
  const descText = `${zone.building} · ${zone.descriptor}`;
  const descSize = isA6 ? 9 : 11;
  const descWidth = fontRegular.widthOfTextAtSize(descText, descSize);
  page.drawText(descText, {
    x: (pageWidth - descWidth) / 2,
    y: currentY,
    size: descSize,
    font: fontRegular,
    color: rgb(0.333, 0.333, 0.357), // ink-2 #55555B
  });

  // CTA Text
  currentY -= isA6 ? 24 : 30;
  const ctaLine1 = 'Scan to tell others how busy it is.';
  const ctaSize = isA6 ? 11 : 14;
  const ctaWidth1 = fontBold.widthOfTextAtSize(ctaLine1, ctaSize);
  page.drawText(ctaLine1, {
    x: (pageWidth - ctaWidth1) / 2,
    y: currentY,
    size: ctaSize,
    font: fontBold,
    color: rgb(0.106, 0.106, 0.114),
  });

  currentY -= isA6 ? 14 : 18;
  const ctaLine2 = 'Takes 3 seconds.';
  const ctaSize2 = isA6 ? 10 : 12;
  const ctaWidth2 = fontRegular.widthOfTextAtSize(ctaLine2, ctaSize2);
  page.drawText(ctaLine2, {
    x: (pageWidth - ctaWidth2) / 2,
    y: currentY,
    size: ctaSize2,
    font: fontRegular,
    color: rgb(0.333, 0.333, 0.357),
  });

  // QR Code (>= 3 cm, readable from 1 m)
  const baseDomain = options.baseUrl || 'https://lsespots.app';
  const qrTargetUrl = `${baseDomain}/z/${zone.slug}?t=${zone.qr_token}`;

  const qrPngBuffer = await QRCode.toBuffer(qrTargetUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 600,
  });

  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const qrSize = isA6 ? 120 : 160;
  currentY -= qrSize + (isA6 ? 8 : 14);

  page.drawImage(qrImage, {
    x: (pageWidth - qrSize) / 2,
    y: currentY,
    width: qrSize,
    height: qrSize,
  });

  // Short URL fallback
  currentY -= isA6 ? 16 : 22;
  const shortCode = zone.slug.split('-')[0] + (zone.floor.match(/\d+/) ? zone.floor.match(/\d+/)![0] : '');
  const shortUrlText = `Can't scan? Open: lsespots.app/z/${zone.slug}`;
  const shortUrlSize = isA6 ? 8.5 : 11;
  const shortUrlWidth = fontBold.widthOfTextAtSize(shortUrlText, shortUrlSize);
  page.drawText(shortUrlText, {
    x: (pageWidth - shortUrlWidth) / 2,
    y: currentY,
    size: shortUrlSize,
    font: fontBold,
    color: rgb(0.106, 0.106, 0.114),
  });

  // Legend of 3 statuses
  currentY -= isA6 ? 28 : 38;
  const legendBoxWidth = pageWidth - margin * 4;
  const legendBoxHeight = isA6 ? 26 : 32;

  page.drawRectangle({
    x: (pageWidth - legendBoxWidth) / 2,
    y: currentY,
    width: legendBoxWidth,
    height: legendBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.84, 0.82),
    borderWidth: 1,
  });

  const legendText = 'Plenty of seats    |    Filling up    |    Full';
  const legendSize = isA6 ? 8 : 10;
  const legendWidth = fontBold.widthOfTextAtSize(legendText, legendSize);
  page.drawText(legendText, {
    x: (pageWidth - legendWidth) / 2,
    y: currentY + (legendBoxHeight - legendSize) / 2,
    size: legendSize,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Footer line
  const footerText = 'Student-built, not affiliated with LSE. Estimates only.';
  const footerSize = isA6 ? 6.5 : 8;
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, footerSize);
  page.drawText(footerText, {
    x: (pageWidth - footerWidth) / 2,
    y: margin + (isA6 ? 6 : 8),
    size: footerSize,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdfDoc.save();
}
