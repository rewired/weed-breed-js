import 'dotenv/config';

process.env.SAVEGAME_PATH = process.env.SAVEGAME_PATH || process.env.DEFAULT_SAVEGAME_PATH || 'data/savegames/default.json';

const argv = process.argv.slice(2);
let daysArg = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--days' && i + 1 < argv.length) {
    daysArg = argv[i + 1];
    break;
  }
}
if (daysArg) {
  process.env.SIM_DAYS = daysArg;
}

await import('../src/sim/run_from_savegame.mjs');
