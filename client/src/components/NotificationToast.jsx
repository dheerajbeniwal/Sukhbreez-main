import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/authContext";

const POLL_INTERVAL = 5000;

export default function NotificationToast() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const knownIds = useRef(new Set());
  const initialized = useRef(false);
  const displayedId = useRef(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let active = true;

    const checkNotifications = async () => {
      try {
        const { data } = await api.get(
          "/notifications?page=1&limit=10&isRead=false",
        );
        if (!active) return;
        const unread = data.data.notifications || [];
        if (!initialized.current) {
          unread.forEach((item) => knownIds.current.add(item.id));
          initialized.current = true;
          if (user?.role === "admin" && unread[0]) {
            displayedId.current = unread[0].id;
            setNotification(unread[0]);
          }
          return;
        }
        if (user?.role === "admin") {
          const pending = unread.find((item) => item.id !== displayedId.current);
          if (pending) {
            displayedId.current = pending.id;
            setNotification(pending);
          }
          return;
        }
        const newest = unread.find((item) => !knownIds.current.has(item.id));
        unread.forEach((item) => knownIds.current.add(item.id));
        if (newest) setNotification(newest);
      } catch {
        // Notification polling must not interrupt the current screen.
      }
    };

    checkNotifications();
    const interval = window.setInterval(checkNotifications, POLL_INTERVAL);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.role]);

  if (!notification) return null;

  return (
    <aside className="notification-toast" role="status" aria-live="polite">
      <div>
        <span className="card-kicker">New notification</span>
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <div className="notification-toast-actions">
        <button
          className="button button-small"
          onClick={async () => {
            await api.patch(`/notifications/${notification.id}/read`);
            displayedId.current = null;
            setNotification(null);
            navigate(
              notification.type === "provider_application"
                ? "/admin/providers"
                : user?.role === "customer"
                ? "/notifications"
                : user?.role === "provider"
                  ? "/provider"
                  : "/admin",
            );
          }}
        >
          {notification.type === "provider_application" ? "Review providers" : user?.role === "customer" ? "View" : "Open workspace"}
        </button>
      </div>
    </aside>
  );
}
