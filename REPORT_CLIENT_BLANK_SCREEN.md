# Client Blank Screen Investigation

## Observations

- Starting the client with missing dependencies produced resolution errors:
  - `Failed to resolve dependency: react, present in client 'optimizeDeps.include'`
  - `Failed to resolve dependency: react-dom, present in client 'optimizeDeps.include'`
- After installing dependencies the dev server served core modules successfully (HTTP 200 for `/` and `/src/main.jsx`).

## Root-Cause Hypotheses

1. Client dependencies were not installed, causing React modules to fail loading and resulting in a white screen.
2. The boot sequence lacked safety checks; if `#root` was absent or rendering threw, nothing was displayed.
3. Missing developer-facing feedback made failures appear as a blank page.

## Decisions

- Ensure client dependencies are installed before running Vite.
- Rename the Vite config to `vite.config.mjs` and keep `root` pointing to `/apps/client` with the React plugin enabled.
- Harden the boot code with diagnostics, add a dev-only error boundary, and show a small "DEV" badge for immediate feedback.
