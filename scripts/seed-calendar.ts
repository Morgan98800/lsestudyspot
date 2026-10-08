import fs from 'fs';
import path from 'path';
import { parseAcademicPeriodsCsv, validateNoPeriodOverlaps } from '../src/lib/algo/calendar';
import { SpotsRepository } from '../src/lib/db/repository';

async function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'academic-periods.template.csv');
  console.log(`Loading academic periods from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const periods = parseAcademicPeriodsCsv(csvContent);

  console.log(`Parsed ${periods.length} academic periods.`);

  const validation = validateNoPeriodOverlaps(periods);
  if (!validation.isValid) {
    console.error(`Validation failed: ${validation.error}`);
    process.exit(1);
  }

  for (const period of periods) {
    await SpotsRepository.createAcademicPeriod(period);
    console.log(`  + Seeded [${period.academic_year}] ${period.name} (${period.type}: ${period.start_date} to ${period.end_date})`);
  }

  console.log('\nAcademic calendar successfully seeded! Remember: verify all dates against LSE official calendar before launch (TODO_VERIFY).');
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
