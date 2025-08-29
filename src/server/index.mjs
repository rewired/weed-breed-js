// src/server/index.mjs
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachUiWs } from '../sim/uiStreamWs.js';
import { createSimController } from './simControl.mjs';
import { createStrainRouter } from './strainRouter.mjs';
import pkg from '../../package.json' assert { type: 'json' };

const PORT = Number(process.env.PORT || 7071);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Routes
const sim = createSimController();
app.use('/api/sim', sim.router);
app.use('/api/strains', createStrainRouter().router);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', version: pkg.version, uptime: process.uptime() });
});

// Serve built client
app.use(express.static(path.resolve(__dirname, '../../dist/client')));
app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../dist/client/index.html'));
});

const server = http.createServer(app);

// Bridge runtime telemetry to the UI
attachUiWs(server, { path: '/ui', logger: console });

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
