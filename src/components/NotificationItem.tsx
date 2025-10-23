import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "../utils/timeUtils";
import "./NotificationItem.css";

interface NotificationActivity {
  id: string;
  type: "follow" | "reaction" | "comment";
  user: {
    id: string;
    name: string;
    custom?: any;
  };
  created_at?: Date | string;
  updated_at?: Date | string;
  notification_context?: {
    trigger?: any;
    target?: any;
  };
  text?: string;
  custom?: any;
}

interface NotificationItemProps {
  notification: NotificationActivity;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const navigate = useNavigate();

  const handleNotificationClick = () => {
    if (notification.type === "follow") {
      navigate(`/profile/${notification.user.id}`);
    } else if (notification.type === "reaction") {
      const targetId = notification.notification_context?.target?.id;
      if (targetId) {
        navigate(`/feeds?postId=${targetId}`);
      } else {
        navigate("/feeds");
      }
    } else if (notification.type === "comment") {
      const targetId = notification.notification_context?.target?.id;
      if (targetId) {
        navigate(`/feeds?postId=${targetId}`);
      } else {
        navigate("/feeds");
      }
    }
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case "follow":
        return "👤";
      case "reaction":
        return "❤️";
      case "comment":
        return "💬";
      default:
        return "🔔";
    }
  };

  const getNotificationText = () => {
    const actorName = notification.user?.name || notification.user?.id || "Someone";
    
    switch (notification.type) {
      case "follow":
        return (
          <>
            <span className="notification-actor">{actorName}</span> started following you
          </>
        );
      case "reaction":
        return (
          <>
            <span className="notification-actor">{actorName}</span> liked your post
          </>
        );
      case "comment":
        return (
          <>
            <span className="notification-actor">{actorName}</span> commented on your post
          </>
        );
      default:
        return notification.text || "New notification";
    }
  };

  const timestamp = notification.created_at;

  return (
    <div
      className="notification-item-card"
      onClick={handleNotificationClick}
      role="button"
      tabIndex={0}
    >
      <div className="notification-item-avatar">
        <Avatar
          userId={notification.user?.id}
          userName={notification.user?.name || notification.user?.id}
          size="md"
        />
        <span className="notification-item-icon">{getNotificationIcon()}</span>
      </div>

      <div className="notification-item-content">
        <div className="notification-item-text">{getNotificationText()}</div>

        {notification.type === "comment" && notification.text && (
          <div className="notification-item-preview">
            "{notification.text}"
          </div>
        )}

        {timestamp && (
          <div className="notification-item-time">
            {formatRelativeTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

