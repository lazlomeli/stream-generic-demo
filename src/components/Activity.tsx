import { ActivityResponse } from "@stream-io/feeds-client";
import { UserAvatar } from "./UserActions";
import { UserActions } from "./UserActions";
import { useUser } from "../hooks/feeds/useUser";
import { Trash2 } from "lucide-react";
import ReactionsPanel from "./Reaction";
import { useFeedActions } from "../hooks/feeds/useFeedActions";
import CommentsPanel from "./Comment";
import { useNavigate } from "react-router-dom";
import "./Activity.css";

export default function Activity({ activity }: { activity: ActivityResponse }) {
  const { user } = useUser();
  const { handleDeleteActivity } = useFeedActions();
  const navigate = useNavigate();

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
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
            <div className="activity-user-details">
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
              {activity.user?.id && activity.user.id !== user?.nickname && (
                // Follow button
                <UserActions targetUserId={activity.user.id} />
              )}
              {activity.user?.id === user?.nickname && (
                <button
                  onClick={() => handleDeleteActivity(activity.id)}
                  className="activity-delete-button"
                  title="Delete activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <p className="activity-text">
            {activity.text || activity.type}
          </p>
        </div>
      </div>

      <ReactionsPanel activity={activity} />
      <CommentsPanel activity={activity} />
    </article>
  );
}
