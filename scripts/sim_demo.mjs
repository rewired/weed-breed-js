import fs from 'node:fs';

process.env.RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '');
fs.mkdirSync('reports', { recursive: true });

await import('../src/sim/run_demo.mjs');
