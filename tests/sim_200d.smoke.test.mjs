import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const summaryPath = path.resolve(__dirname, '../reports/sim_200d_summary.json');

const summaryExists = fs.existsSync(summaryPath);

const run = summaryExists ? test : test.skip;

run('200d simulation summary sanity', () => {
  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  expect(data.global.totalBuds_g).toBeGreaterThan(0);
  const hasHarvest = (data.zones || []).some(z => (z.harvestEvents || 0) >= 1);
  expect(hasHarvest).toBe(true);
  if (data.global.replantEventsTotal != null) {
    expect(data.global.replantEventsTotal).toBeGreaterThan(0);
  }
});

if (!summaryExists) {
  test.skip('missing summary – run `npm run sim:200d:report` to generate', () => {});
}

jest.setTimeout(5000);
