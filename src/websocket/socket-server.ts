import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import url from "url";
import { verifyAccessToken } from "../utils/crypto.utils";

const connections = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const { query } = url.parse(req.url || "", true);
    const token = query.token as string | undefined;

    if (!token) {
      socket.close(4001, "Missing auth token");
      return;
    }

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      socket.close(4002, "Invalid or expired token");
      return;
    }

    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId)!.add(socket);

    (socket as any).isAlive = true;
    socket.on("pong", () => {
      (socket as any).isAlive = true;
    });

    socket.on("close", () => {
      const userSockets = connections.get(userId);
      userSockets?.delete(socket);
      if (userSockets?.size === 0) connections.delete(userId);
    });
  });

  // Kills half-open connections (laptop slept, network dropped without a
  // clean close frame) so `connections` doesn't silently accumulate dead
  // sockets that look connected but can't actually receive anything.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      if ((socket as any).isAlive === false) return socket.terminate();
      (socket as any).isAlive = false;
      socket.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

export function sendToUsers(userIds: string[], payload: unknown): void {
  const message = JSON.stringify(payload);
  for (const userId of userIds) {
    const sockets = connections.get(userId);
    if (!sockets) continue;
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}
