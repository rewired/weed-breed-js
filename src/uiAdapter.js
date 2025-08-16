import http from "node:http";
import { WebSocketServer } from "ws";
// uiStream$ ist dein bestehender Event-Stream (RxJS) aus der Tick-Engine
import { uiStream$ } from "./eventBus.js"; // Pfad ggf. anpassen

export function startUIBridge({ port = 8077 } = {}) {
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: "/ws" });

  // WS: Broadcast der UI-Batches
  uiStream$.subscribe(batch => {
    const payload = JSON.stringify({ type: "ui.batch", batch });
    for (const c of wss.clients) if (c.readyState === 1) c.send(payload);
  });

  // SSE: Fallback-Endpunkt
  server.on("request", (req, res) => {
    if (req.url !== "/sse") { res.statusCode = 404; return res.end("not found"); }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    const sub = uiStream$.subscribe(batch => {
      res.write(`event: ui.batch\ndata:${JSON.stringify(batch)}\n\n`);
    });
    req.on("close", () => sub.unsubscribe());
  });

  server.listen(port, () => {
    console.log(`[ui-bridge] listening on ${port} (ws /ws, sse /sse)`);
  });
  return server;
}
