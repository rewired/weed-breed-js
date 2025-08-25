# 200-Day Simulation Check

Run a reproducible 200-day simulation (4800 ticks) and collect basic reports.

## Run

```bash
npm run sim:200d:report
```

Optional environment variables:
- `SIM_DAYS` – number of days to simulate (default `200`).
- `WB_SEED` – RNG seed (default `codex-checkup-001`).
- `AUTO_REPLANT` – `true`/`false` (default `true`).

## Outputs

Reports are written to `reports/`:

- `sim_200d_log.csv` – chronological event log
- `sim_200d_daily.jsonl` – one JSON line per zone and day
- `sim_200d_summary.json` – aggregated statistics
- `sim_200d_summary.md` – summary as Markdown tables

Key metrics:

- `global.totalBuds_g` – total harvested buds (must be > 0)
- `harvestEvents` – number of harvests per zone
- `global.replantEventsTotal` – total replants (with `AUTO_REPLANT=true`)

The RNG is deterministic when `WB_SEED` is set.
