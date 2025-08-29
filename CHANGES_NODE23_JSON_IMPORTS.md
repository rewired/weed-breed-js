# Node v23 JSON Import Changes

- `.eslintrc.json`: enable `ecmaVersion: 2024` and `es2024` env for import attributes.
- `src/server/index.mjs`: use `with { type: 'json' }` for `package.json` import and log package version at startup.
- `packages/wb-model/index.js`: switch schema exports to `with { type: 'json' }`.
