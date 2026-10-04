import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DATA_DIR = join(REPO_ROOT, 'data');

export const dataPaths = (dataDir: string = DATA_DIR) => ({
  root: dataDir,
  birthdays: join(dataDir, 'birthdays.yaml'),
  birthdaysReviewed: join(dataDir, 'birthdays.reviewed'),
  motifEn: join(dataDir, 'motif_en.yaml'),
  affirmations: join(dataDir, 'affirmations.yaml'),
  calendarDir: join(dataDir, 'calendar'),
});
