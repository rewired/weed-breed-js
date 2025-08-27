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
export function attachUiWs(server, { path = '/ws/ui', logger = console } = {}) {
  const wss = new WebSocketServer({ server, path });

  wss.on('connection', (ws) => {
    logger.info?.({ msg: 'ui ws connected', clients: wss.clients.size });
    const sub = uiStream$.subscribe((events) => {
      try {
        ws.send(JSON.stringify({ type: 'ui.batch', events }));
      } catch (err) {
        logger.warn?.({ msg: 'ui ws send failed', err: String(err) });
      }
    });
    const cleanup = () => {
      sub.unsubscribe();
      logger.info?.({ msg: 'ui ws disconnected', clients: wss.clients.size - 1 });
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
    ws.on('message', () => {}); // telemetry only
  });
  return wss;
}
