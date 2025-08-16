// ESM, Node 20+
// Startet WS (/ws) und SSE (/sse) und leitet UI-Event-Batches weiter.
// Erwartet, dass du irgendwo im Sim-Prozess einen RxJS-Stream uiStream$ hast.
// Passe den Import unten an DEINEN Pfad an:
import http from "node:http";
import { WebSocketServer } from "ws";

// ⚠️ Pfad ggf. anpassen:
import { uiStream$ } from "./eventBus.js"; // muss ein Observable von Arrays sein

export function startUIBridge({ port = 8077, allowOrigin = "*" } = {}) {
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: "/ws" });

  // WS-Bridge
  const wsBroadcast = (batch) => {
    const payload = JSON.stringify({ type: "ui.batch", batch });
    for (const c of wss.clients) {
      if (c.readyState === 1) c.send(payload);
    }
  };

  // SSE-Bridge
  server.on("request", (req, res) => {
    if (req.url !== "/sse") {
      res.statusCode = 404;
      return res.end("not found");
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": allowOrigin
    });
    const sub = uiStream$.subscribe((batch) => {
      res.write(`event: ui.batch\ndata:${JSON.stringify(batch)}\n\n`);
    });
    req.on("close", () => sub.unsubscribe());
  });

  // Sub auf Stream für WS
  const sub = uiStream$.subscribe(wsBroadcast);

  server.listen(port, () => {
    console.log(`[ui-bridge] listening on ${port}  (ws:/ws  sse:/sse)`);
  });

  return {
    close() {
      sub.unsubscribe();
      server.close();
      wss.close();
    }
  };
}
