// src/server/index.mjs
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { WebSocketServer } from 'ws';
import { uiStream$ } from '../sim/eventBus.mjs';
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

// WebSocket for UI telemetry
const wss = new WebSocketServer({ server, path: '/ws/ui' });
wss.on('connection', (ws) => {
  const sub = uiStream$.subscribe((evt) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(evt));
  });
  ws.on('close', () => sub.unsubscribe());
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
