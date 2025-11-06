import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "../utils/timeUtils";
import heartFilledIcon from "../icons/heart-filled.svg";
import commentIcon from "../icons/comment.svg";
import userHeartIcon from "../icons/user-heart.svg";
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
        navigate(`/feeds/for-you?postId=${targetId}`);
      } else {
        navigate("/feeds/for-you");
      }
    } else if (notification.type === "comment") {
      const targetId = notification.notification_context?.target?.id;
      if (targetId) {
        navigate(`/feeds/for-you?postId=${targetId}`);
      } else {
        navigate("/feeds/for-you");
      }
    }
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case "follow":
        return (
          <img
            src={userHeartIcon}
            alt="Follow"
            width="16"
            height="16"
            className="notification-icon follow-icon"
          />
        );
      case "reaction":
        return (
          <img
            src={heartFilledIcon}
            alt="Like"
            width="16"
            height="16"
            className="notification-icon like-icon"
          />
        );
      case "comment":
        return (
          <img
            src={commentIcon}
            alt="Comment"
            width="16"
            height="16"
            className="notification-icon comment-icon"
          />
        );
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
      </div>

      <div className="notification-item-content">
        <div className="notification-item-text">
          <span className="notification-item-icon-inline">{getNotificationIcon()}</span>
          {getNotificationText()}
        </div>

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

