import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { authenticateSocket } from "./socketAuth.js";

let ioInstance: Server | null = null;

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "https://veyratms.site",
        "https://www.veyratms.site",
        "https://task-management-system-client.vercel.app",
        "http://localhost:5173",
      ],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await authenticateSocket(socket);
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    if (process.env.NODE_ENV === "development") {
      console.log(`Socket connected: ${socket.id} (${user.id})`);
    }

    socket.on("notification:ping", (callback?: (response: { ok: boolean }) => void) => {
      callback?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (process.env.NODE_ENV === "development") {
        console.log(`Socket disconnected: ${socket.id} (${user.id})`);
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getIo(): Server | null {
  return ioInstance;
}
