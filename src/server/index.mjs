// src/server/index.mjs
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { attachUiWs } from '../sim/uiStreamWs.js';
import { createSimController } from './simControl.mjs';
import { createStrainRouter } from './strainRouter.mjs';

const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Routes
const sim = createSimController();
app.use('/api/sim', sim.router);
app.use('/api/strains', createStrainRouter().router);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

// Bridge runtime telemetry to the UI
attachUiWs(server, { path: '/ws/ui', logger: console });

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
