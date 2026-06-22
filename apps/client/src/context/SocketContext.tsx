import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Socket } from "socket.io-client";
import type { User } from "../services/api";
import { createAuthenticatedSocket, SOCKET_URL } from "../services/socket";

type SocketStatus = "connected" | "connecting" | "disconnected";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue | null>(null);

function logSocket(message: string, details?: unknown) {
  if (!import.meta.env.DEV) return;
  if (typeof details === "undefined") {
    console.log(`[socket] ${message}`);
    return;
  }
  console.log(`[socket] ${message}`, details);
}

export function SocketProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const socket = useMemo(() => (user ? createAuthenticatedSocket() : null), [user?.id]);
  const [status, setStatus] = useState<SocketStatus>("disconnected");

  useEffect(() => {
    logSocket("provider mounted");

    return () => {
      logSocket("provider unmounted");
    };
  }, []);

  useLayoutEffect(() => {
    if (!socket || !user) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    logSocket("auth user available", { userId: user.id });

    const handleConnect = () => {
      setStatus("connected");
      logSocket("connected", { id: socket.id, url: SOCKET_URL });
    };
    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      setStatus("disconnected");
      logSocket("disconnected", reason);
    };
    const handleConnectError = (error: Error) => {
      setStatus("disconnected");
      logSocket("connect_error", error.message);
    };
    const handleAny = (eventName: string, ...args: unknown[]) => {
      logSocket(`event ${eventName}`, args[0]);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.onAny(handleAny);

    logSocket("connecting", { url: SOCKET_URL });
    if (socket.connected) {
      setStatus("connected");
      logSocket("already connected", { id: socket.id, url: SOCKET_URL });
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.offAny(handleAny);
      socket.disconnect();
      setStatus("disconnected");
    };
  }, [socket, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, status }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
