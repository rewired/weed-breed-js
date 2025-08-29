# Client Connectivity Changes

- Added health endpoint `/healthz` and standardised server port to `7071`.
- Unified WebSocket stream at path `/ui` sending `{ type: 'ui.batch', events: [...] }` batches.
- Normalised environment variables to `VITE_SERVER_URL` and `VITE_WS_PATH`.
- Updated Vite proxy and root scripts for concurrent client/server dev.
- Introduced connection banner and in-browser dev console for telemetry.
