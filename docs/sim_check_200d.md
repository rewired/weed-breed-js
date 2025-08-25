# 200-Day Simulation Check

Run a reproducible 200-day simulation (4800 ticks) and collect basic reports.

## Run

```bash
npm run sim:200d:report
```

The script uses `cross-env` so environment variables work on Windows and macOS.
To recompute summaries from existing artifacts:

```bash
npm run sim:recompute
```

Optional environment variables for `sim:200d:report`:
- `SIM_DAYS` – number of days to simulate (default `200`).
- `WB_SEED` – RNG seed (default `codex-checkup-001`).
- `AUTO_REPLANT` – `true`/`false` (default `true`).

## Outputs

Reports are written to `reports/`:

- `sim_200d_log.csv` – chronological event log
- `sim_200d_daily.jsonl` – one JSON line per zone and day (end-of-day snapshot)
- `sim_200d_summary.json` – aggregated statistics
- `sim_200d_summary.md` – summary as Markdown tables with `day1Biomass_g`

Key metrics:

- `global.totalBuds_g` – total harvested buds (must be > 0)
- `harvestEvents` – number of harvests per zone
- `global.replantEventsTotal` – total replants (with `AUTO_REPLANT=true`)

Daily rows are snapshots, so compare `day1Biomass_g` with the final day to verify growth.
`sim_200d_log.csv` can be inspected to check replant events and other milestones.

The RNG is deterministic when `WB_SEED` is set.
