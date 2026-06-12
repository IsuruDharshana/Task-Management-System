import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "./api";

export function createAuthenticatedSocket(): Socket {
  return io(API_ORIGIN, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: false,
  });
}
