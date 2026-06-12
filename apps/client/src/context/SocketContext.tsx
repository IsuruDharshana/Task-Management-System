import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Socket } from "socket.io-client";
import type { User } from "../services/api";
import { createAuthenticatedSocket } from "../services/socket";

type SocketStatus = "connected" | "connecting" | "disconnected";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const socket = useMemo(() => (user ? createAuthenticatedSocket() : null), [user?.id]);
  const [status, setStatus] = useState<SocketStatus>("disconnected");

  useEffect(() => {
    if (!socket || !user) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleConnectError = () => setStatus("disconnected");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      setStatus("disconnected");
    };
  }, [socket, user]);

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
