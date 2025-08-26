/**
 * Fails if any non-sim code imports from src/sim/*.
 * Scans src/** excluding src/sim/**
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (p.includes(path.join('src', 'sim'))) continue; // skip sim tree
      yield* walk(p);
    } else if (/\.(mjs|js|ts|mts|jsx|tsx)$/.test(ent.name)) {
      yield p;
    }
  }
}

test('no imports from src/sim/* in domain code', () => {
  const offenders = [];
  for (const file of walk(root)) {
    const txt = fs.readFileSync(file, 'utf8');
    const bad =
      txt.match(/from\s+['"][.]{0,2}\/sim\/(Zone|Plant)\.js['"]/g) ||
      txt.match(/from\s+['"]src\/sim\/(Zone|Plant)\.js['"]/g);
    if (bad) offenders.push(file);
  }
  if (offenders.length) {
    console.error('Found forbidden sim imports:\n' + offenders.join('\n'));
  }
  expect(offenders).toHaveLength(0);
});
