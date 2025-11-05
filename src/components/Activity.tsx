import { ActivityResponse } from "@stream-io/feeds-client";
import { UserAvatar } from "./UserActions";
import { UserActions } from "./UserActions";
import { useUser } from "../hooks/feeds/useUser";
import trashIcon from "../icons/trash.svg";
import ReactionsPanel from "./Reaction";
import { useFeedActions } from "../hooks/feeds/useFeedActions";
import CommentsPanel from "./Comment";
import { useNavigate } from "react-router-dom";
import { useResponsive } from "../contexts/ResponsiveContext";
import { useState } from "react";
import "./Activity.css";

interface ActivityProps {
  activity: ActivityResponse;
  hideFollowButton?: boolean;
  forceBookmarked?: boolean;
  compactMode?: boolean;
}

export default function Activity({ activity, hideFollowButton = false, forceBookmarked = false, compactMode = false }: ActivityProps) {
  const { user } = useUser();
  const { handleDeleteActivity } = useFeedActions();
  const { isMobileView } = useResponsive();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleHashtagClick = (hashtag: string) => {
    navigate(`/feeds/hashtag/${hashtag.toLowerCase()}`);
  };

  const renderTextWithHashtags = (text: string) => {
    if (!text) return text;
    
    const parts = text.split(/(#\w+)/g);
    
    return parts.map((part, index) => {
      if (part.match(/^#\w+$/)) {
        const hashtag = part.slice(1);
        return (
          <span
            key={index}
            className="hashtag-link"
            onClick={(e) => {
              e.stopPropagation();
              handleHashtagClick(hashtag);
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <article className="activity-container">
      <div className="activity-header">
        {activity.user?.id ? (
          <div 
            onClick={() => {handleUserClick(activity.user.id); console.log('activity.user.id', activity.user.id)}}
            className="activity-user-avatar"
          >
            <UserAvatar userId={activity.user?.name || "..."} />
          </div>
        ) : (
          <UserAvatar userId={activity.user?.name || "..."} />
        )}
        <div className="activity-content">
          <div className="activity-user-info">
            <div className={`activity-user-details ${isMobileView ? 'mobile' : ''}`}>
              {activity.user?.id ? (
                <button
                  onClick={() => handleUserClick(activity.user.id)}
                  className="activity-username-button"
                >
                  {activity.user?.name || activity.user?.id || "..."}
                </button>
              ) : (
                <span className="activity-username-text">
                  {activity.user?.name || activity.user?.id || "..."}
                </span>
              )}
              {activity.created_at && (
                <span className="activity-timestamp">
                  {new Date(activity.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="activity-actions">
              {!hideFollowButton && activity.user?.id && activity.user.id !== user?.nickname && (
                // Follow button
                <UserActions targetUserId={activity.user.id} iconOnly={compactMode} />
              )}
              {activity.user?.id === user?.nickname && (
                <button
                  onClick={() => handleDeleteActivity(activity.id)}
                  className="activity-delete-button"
                  title="Delete activity"
                >
                  <img src={trashIcon} alt="Delete" width="18" height="18" className="delete-icon" />
                </button>
              )}
            </div>
          </div>
          <p className="activity-text">
            {renderTextWithHashtags(activity.text || activity.type)}
          </p>
        </div>
      </div>

      <ReactionsPanel 
        activity={activity} 
        onCommentsClick={() => setShowComments(!showComments)}
        forceBookmarked={forceBookmarked}
      />
      <CommentsPanel 
        activity={activity} 
        showComments={showComments}
        onToggleComments={() => setShowComments(!showComments)}
      />
    </article>
  );
}
