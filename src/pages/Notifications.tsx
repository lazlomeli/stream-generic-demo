import { useNotifications } from "../hooks/feeds/useNotifications";
import { useUser } from "../hooks/feeds/useUser";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useResponsive } from "../contexts/ResponsiveContext";
import { NotificationItem } from "../components/NotificationItem";
import MobileBottomNav from "../components/MobileBottomNav";
import "./Notifications.css";

export default function NotificationsPage() {
  const { error, loading: clientLoading } = useUser();
  const {
    notifications,
    isLoading: notificationsLoading,
    error: notificationsError,
    markAsSeen,
  } = useNotifications();
  const location = useLocation();
  const { isMobileView, toggleView } = useResponsive();

  const loading = clientLoading || notificationsLoading;

  const hasMarkedAsSeenRef = useRef(false);

  useEffect(() => {
    if (
      !hasMarkedAsSeenRef.current && 
      notifications && 
      notifications.length > 0
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

  const notificationsContent = (
    <div className="feeds-container">
      <div className="notifications-header">
        <h1 className="notifications-title">Notifications</h1>
        <p className="notifications-subtitle">
          Get notified when someone follows you, comments on your posts, or
          likes your content.
        </p>
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty-title">No notifications yet</div>
          <p className="notifications-empty-description">
            When you get notifications, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <NotificationItem
              key={`notification-${notification.id}`}
              notification={notification as any}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (isMobileView) {
    return (
      <div className="notifications-page-container mobile-view">
        <div className="notifications-page-content mobile-content">
          {notificationsContent}
          <MobileBottomNav currentPath={location.pathname} />
        </div>
        <div className="mobile-view-toggle" title="Switch to Desktop View">
          <span className="toggle-label active">Mobile</span>
          <button
            onClick={toggleView}
            className="toggle-track mobile-active"
            role="switch"
            aria-checked={true}
          >
            <span className="toggle-thumb" />
          </button>
          <span className="toggle-label">Desktop</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-page-container desktop-view">
      <div className="notifications-page-content desktop-content">
        {notificationsContent}
      </div>
    </div>
  );
}