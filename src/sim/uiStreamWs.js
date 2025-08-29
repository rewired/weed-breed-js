// src/sim/uiStreamWs.js
/**
 * WebSocket forwarder for UI telemetry (read-only).
 */
import { WebSocketServer } from 'ws';
import { uiStream$ } from '../runtime/eventBus.js';

/**
 * Attach WS bridge forwarding uiStream$ batches.
 * @param {import('http').Server} server
 * @param {{path?:string, logger?:import('pino').Logger}} [opts]
 */
export function attachUiWs(server, { path = '/ui', logger = console } = {}) {
  const wss = new WebSocketServer({ server, path });

  wss.on('connection', (ws) => {
    logger.info?.({ msg: 'ui ws connected', clients: wss.clients.size });
    const sub = uiStream$.subscribe((batch) => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'ui.batch', events: batch }));
        }
      } catch (err) {
        logger.warn?.({ msg: 'ui ws send failed', err: String(err) });
      }
    });
    const cleanup = () => {
      try { sub.unsubscribe(); } catch {}
      logger.info?.({ msg: 'ui ws disconnected', clients: Math.max(0, wss.clients.size - 1) });
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
    ws.on('message', () => {}); // telemetry only
  });

  return wss;
}
