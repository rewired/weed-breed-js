#!/usr/bin/env node
/**
 * Codemod: Replace imports from src/sim/* to src/engine/*.
 * Safe text replacement with summary. ESM/Node v23+.
 * Usage:
 *   node scripts/codemods/fix-sim-imports.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const includeExt = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.jsx', '.tsx']);
const dryRun = !process.argv.includes('--write');

const rules = [
  { from: /(['"])\.\/sim\/Zone\.js\1/g, to: '$1./engine/Zone.js$1' },
  { from: /(['"])\.\.\/sim\/Zone\.js\1/g, to: '$1../engine/Zone.js$1' },
  { from: /(['"])\.\/sim\/Plant\.js\1/g, to: '$1./engine/Plant.js$1' },
  { from: /(['"])\.\.\/sim\/Plant\.js\1/g, to: '$1../engine/Plant.js$1' },
  { from: /(['"])src\/sim\/Zone\.js\1/g, to: '$1src/engine/Zone.js$1' },
  { from: /(['"])src\/sim\/Plant\.js\1/g, to: '$1src/engine/Plant.js$1' }
];

let visited = 0, changed = 0, repl = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(ent.name)) continue;
      walk(p);
      continue;
    }
    const ext = path.extname(ent.name);
    if (!includeExt.has(ext)) continue;

    visited++;
    let txt = fs.readFileSync(p, 'utf8');
    let before = txt;
    for (const { from, to } of rules) {
      txt = txt.replace(from, to);
    }
    if (txt !== before) {
      changed++;
      const count = (before.match(/sim\/(Zone|Plant)\.js/g) || []).length;
      repl += count;
      if (!dryRun) fs.writeFileSync(p, txt);
      console.log(`${dryRun ? '[dry-run] ' : ''}fixed imports in ${path.relative(repoRoot, p)} (${count})`);
    }
  }
}

['src', 'tests', 'scripts'].forEach(d => {
  const abs = path.join(repoRoot, d);
  if (fs.existsSync(abs)) walk(abs);
});

console.log(`Visited ${visited} files, ${changed} changed, ${repl} replacements ${dryRun ? '(dry-run)' : ''}.`);
if (dryRun) console.log('Run with --write to apply changes.');
