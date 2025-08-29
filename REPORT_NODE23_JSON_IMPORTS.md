# Node v23 JSON Import Migration Report

## Findings before fixes

| File | Line | Original snippet | Strategy | Notes |
| --- | --- | --- | --- | --- |
| src/server/index.mjs | 11 | `import pkg from '../../package.json' assert { type: 'json' };` | Static JSON import switched to `with { type: 'json' }`. | Used for health endpoint and startup log. |
| packages/wb-model/index.js | 2-5 | `export { ... } from "./schemas/*.json" assert { type: "json" };` | Static exports switched to `with { type: 'json' }`. | Package consumed on server side. |
| apps/client/src/components/StrainEditor.jsx | 10 | `import schema from '@/schemas/strain.schema.json';` | Left unchanged. | Client bundler (Vite) already handles JSON modules. |
| scripts/validate_data.mjs | 17 | `JSON.parse(await fs.readFile(...))` | Already uses `fs/promises`; no change. | Dynamic load, path resolved at runtime. |

## Risks & Boundaries

- No `require()` calls for JSON were found.
- Client-facing code remains untouched to avoid bundler regressions.
