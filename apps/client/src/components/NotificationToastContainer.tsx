import { useNotifications } from "../context/NotificationContext";

export default function NotificationToastContainer() {
  const { notificationToasts, dismissNotificationToast } = useNotifications();

  if (notificationToasts.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-container" aria-live="polite" aria-atomic="false">
      {notificationToasts.map((notification) => (
        <article className="notification-toast" key={notification.id}>
          <div className="notification-toast-content">
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </div>
          <button
            type="button"
            className="notification-toast-close"
            aria-label="Close notification toast"
            onClick={() => dismissNotificationToast(notification.id)}
          >
            x
          </button>
        </article>
      ))}
    </div>
  );
}
