import fs from 'fs';
import path from 'path';
import { STARTER_ZONES } from '../src/lib/data/starter-zones';
import { generatePosterPdf } from '../src/lib/poster/generator';

async function run() {
  const outputDir = path.join(process.cwd(), 'dist', 'posters');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating printable signage for ${STARTER_ZONES.length} zones...`);

  for (const zone of STARTER_ZONES) {
    // A5 Wall Poster
    const pdfA5 = await generatePosterPdf(zone, { size: 'A5' });
    const filenameA5 = `${zone.slug}_A5_wall.pdf`;
    fs.writeFileSync(path.join(outputDir, filenameA5), pdfA5);

    // A6 Table Stand
    const pdfA6 = await generatePosterPdf(zone, { size: 'A6' });
    const filenameA6 = `${zone.slug}_A6_stand.pdf`;
    fs.writeFileSync(path.join(outputDir, filenameA6), pdfA6);

    console.log(`✓ Generated ${filenameA5} & ${filenameA6}`);
  }

  console.log(`\n🎉 Success! All printable PDFs generated in ./dist/posters/`);
  console.log(`NOTE: Placing physical posters requires approval from LSE Library / SU / Estates.`);
}

run().catch((err) => {
  console.error('Error generating posters:', err);
  process.exit(1);
});
