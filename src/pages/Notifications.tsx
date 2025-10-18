import { useNotifications } from "../hooks/feeds/useNotifications";
import { useUser } from "../hooks/feeds/useUser";
import { useEffect, useRef } from "react";
import { NotificationItem } from "../components/NotificationItem";
import "./Notifications.css";
import { NotificationActivity } from "getstream";

export default function NotificationsPage() {
  const { error, loading: clientLoading } = useUser();
  const {
    notifications,
    isLoading: notificationsLoading,
    error: notificationsError,
    markAsSeen,
  } = useNotifications();

  const loading = clientLoading || notificationsLoading;

  const hasMarkedAsSeenRef = useRef(false);

  useEffect(() => {
    if (
      !hasMarkedAsSeenRef.current && 
      notifications?.aggregated_activities && 
      notifications.aggregated_activities.length > 0
    ) {
      hasMarkedAsSeenRef.current = true;
      markAsSeen();
    }
  }, [notifications, markAsSeen]);

  if (loading) {
    return <div className="notifications-loading">Loading...</div>;
  }

  if (error || notificationsError) {
    return <div className="notifications-error">Error!</div>;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1 className="notifications-title">Notifications</h1>
        <p className="notifications-subtitle">
          Get notified when someone follows you, comments on your posts, or
          likes your content.
        </p>
      </div>

      {!notifications?.aggregated_activities || notifications.aggregated_activities.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty-title">No notifications yet</div>
          <p className="notifications-empty-description">
            When you get notifications, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.aggregated_activities.flatMap((aggregated) => 
            (aggregated.activities || []).map((notification: NotificationActivity) => (
              <NotificationItem
                key={`notification-${notification.id}`}
                notification={notification as any}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}