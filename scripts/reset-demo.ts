import { SpotsRepository } from '../src/lib/db/repository';

async function run() {
  const args = process.argv.slice(2);
  const clearAll = args.includes('--clear');

  console.log(clearAll ? 'Purging all synthetic fake reports...' : 'Resetting seed reports to default 3-week baseline...');
  await SpotsRepository.resetToSeed(clearAll);
  console.log('Done!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
