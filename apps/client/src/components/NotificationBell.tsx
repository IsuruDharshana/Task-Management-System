import { useEffect, useRef, useState } from "react";
import type { NotificationDTO } from "../services/api";
import { useNotifications } from "../context/NotificationContext";
import { useRouter } from "./Router";

function formatNotificationTime(value: string): string {
  const createdAt = new Date(value).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getProjectId(notification: NotificationDTO): string | null {
  const projectId = notification.metadata?.projectId;
  return typeof projectId === "string" && projectId ? projectId : null;
}

export default function NotificationBell() {
  const { navigate } = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleNotificationClick = async (notification: NotificationDTO) => {
    if (!notification.readAt) {
      await markAsRead(notification.id);
    }

    if (notification.entityType === "task") {
      const projectId = getProjectId(notification);
      if (projectId) {
        navigate(`/projects/${projectId}`);
        setOpen(false);
      }
    }
  };

  return (
    <div className="notification-shell" ref={panelRef}>
      <button
        type="button"
        className={`notification-bell ${open ? "active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="notification-bell-icon">
          <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z" />
          <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h2>Notifications</h2>
            <button
              type="button"
              className="notification-mark-all"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>

          {error && <p className="notification-error">{error}</p>}

          <div className="notification-list">
            {loading && notifications.length === 0 && (
              <div className="notification-empty">Loading notifications...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="notification-empty">No notifications yet</div>
            )}

            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`notification-item ${notification.readAt ? "read" : "unread"}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <span className="notification-unread-dot" aria-hidden="true" />
                <span className="notification-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time>{formatNotificationTime(notification.createdAt)}</time>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
