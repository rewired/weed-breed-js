# Client Blank Screen Fix

## Modified

- `apps/client/vite.config.mjs` – converted to ESM config, ensured React plugin, root, and proxy settings.
- `package.json` – updated scripts to reference new Vite config.
- `apps/client/src/main.jsx` – safe boot with diagnostics and timing.
- `apps/client/src/App.jsx` – wrapped app in dev error boundary and added dev badge.

## Added

- `apps/client/src/components/DevBadge.jsx` – small dev-only badge.
- `apps/client/src/components/DevErrorBoundary.jsx` – dev-only error boundary to avoid blank screens.

No other files were changed.
