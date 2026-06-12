import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, APIError } from "../services/api";
import type { NotificationDTO, User } from "../services/api";
import { useSocket } from "./SocketContext";

interface NotificationNewPayload {
  notification: NotificationDTO;
  unreadCount?: number;
}

interface NotificationReadPayload {
  notification: NotificationDTO;
  unreadCount?: number;
}

interface UnreadCountPayload {
  unreadCount: number;
}

interface NotificationContextValue {
  notifications: NotificationDTO[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function sortByCreatedAtDesc(notifications: NotificationDTO[]): NotificationDTO[] {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function upsertNotification(current: NotificationDTO[], notification: NotificationDTO): NotificationDTO[] {
  const existingIndex = current.findIndex((item) => item.id === notification.id);

  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = notification;
    return sortByCreatedAtDesc(next);
  }

  return sortByCreatedAtDesc([notification, ...current]);
}

export function NotificationProvider({ user, children }: { user: User; children: ReactNode }) {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [notificationData, countData] = await Promise.all([
        api.notifications.getNotifications(20),
        api.notifications.getUnreadNotificationCount(),
      ]);

      setNotifications(notificationData.notifications || []);
      setUnreadCount(countData.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, user.id]);

  useEffect(() => {
    if (user.role === "admin") return;

    let cancelled = false;

    const generateDeadlineAlerts = async () => {
      try {
        const result = await api.notifications.generateDeadlineAlerts();
        if (!cancelled && result.createdCount > 0) {
          await refreshNotifications();
        }
      } catch (err) {
        if (err instanceof APIError && err.code === "FORBIDDEN") return;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to generate deadline alerts.");
        }
      }
    };

    generateDeadlineAlerts();

    return () => {
      cancelled = true;
    };
  }, [refreshNotifications, user.id, user.role]);

  useEffect(() => {
    if (!socket) return;

    const handleNotificationNew = (payload: NotificationNewPayload) => {
      setNotifications((current) => upsertNotification(current, payload.notification));
      if (typeof payload.unreadCount === "number") {
        setUnreadCount(payload.unreadCount);
      } else {
        setUnreadCount((current) => current + 1);
      }
    };

    const handleUnreadCount = (payload: UnreadCountPayload) => {
      setUnreadCount(payload.unreadCount);
    };

    const handleNotificationRead = (payload: NotificationReadPayload) => {
      setNotifications((current) => upsertNotification(current, payload.notification));
      if (typeof payload.unreadCount === "number") {
        setUnreadCount(payload.unreadCount);
      }
    };

    const handleReadAll = () => {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        }))
      );
      setUnreadCount(0);
    };

    socket.on("notification:new", handleNotificationNew);
    socket.on("notification:unread-count", handleUnreadCount);
    socket.on("notification:read", handleNotificationRead);
    socket.on("notification:read-all", handleReadAll);

    return () => {
      socket.off("notification:new", handleNotificationNew);
      socket.off("notification:unread-count", handleUnreadCount);
      socket.off("notification:read", handleNotificationRead);
      socket.off("notification:read-all", handleReadAll);
    };
  }, [socket]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const result = await api.notifications.markNotificationRead(notificationId);
    setNotifications((current) => upsertNotification(current, result.notification));
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await api.notifications.markAllNotificationsRead();
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt,
      }))
    );
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, loading, error, refreshNotifications, markAsRead, markAllAsRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
