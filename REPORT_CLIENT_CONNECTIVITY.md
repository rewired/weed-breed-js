# Client Connectivity Report

## Overview
- **Server port**: `7071` (configurable via `PORT`)
- **HTTP base**: `http://localhost:7071`
- **Health endpoint**: `GET /healthz`
- **API prefix**: `/api`
- **WebSocket path**: `/ui`
- **Client dev server**: Vite on `5173` with proxy rules for `/healthz`, `/api`, and `/ui`

## Findings
- Client WebSocket bridge connected but received no data.
- Server forwarded raw JSON arrays while client expected an object `{ type: 'ui.batch', events: [...] }`.
- Env variables differed (`VITE_API_BASE`/`VITE_WS_URL` vs. desired `VITE_SERVER_URL`/`VITE_WS_PATH`).

## Root Cause Hypothesis
Message format mismatch between server (`[]`) and client (`{type:'ui.batch', events:[]}`) prevented client from processing batches, resulting in "connected" status without telemetry.

## Fix Plan
1. Wrap server batches as `{ type: 'ui.batch', events: batch }`.
2. Standardize WebSocket path to `/ui` and update proxies/env vars.
3. Add `/healthz` endpoint and adjust client API base to `VITE_SERVER_URL`/`VITE_WS_PATH`.
4. Expose connection status and dev log on client for easier debugging.
