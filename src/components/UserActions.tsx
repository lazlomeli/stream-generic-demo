import { UserPlus, UserMinus } from "lucide-react";
import { Avatar } from "./Avatar";
import "./UserActions.css";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { useUser } from "../hooks/feeds/useUser";
import { useResponsive } from "../contexts/ResponsiveContext";

interface UserActionsProps {
  targetUserId: string;
  iconOnly?: boolean;
}

export function UserActions({ targetUserId, iconOnly = false }: UserActionsProps) {
  const { user } = useUser();
  const { isMobileView } = useResponsive();
  const { 
    followUser, 
    unfollowUser, 
    isFollowing, 
    isFollowingLoading, 
    isUnfollowingLoading 
  } = useProfileStats(targetUserId);

  const currentUserId = user?.nickname || "";
  const isOwnUser = targetUserId === currentUserId;
  const isLoading = isFollowingLoading || isUnfollowingLoading;
  const following = isFollowing(targetUserId);

  if (isOwnUser) {
    return null; // Don't show follow button for own posts
  }

  return (
    <button
      onClick={() => {
        following ? unfollowUser(targetUserId) : followUser(targetUserId);
      }}
      disabled={isLoading}
      className={`user-action-button ${following ? "following" : ""} ${iconOnly ? "icon-only" : ""} ${isMobileView ? "mobile" : ""}`}
      title={following ? "Unfollow" : "Follow"}
    >
      {isLoading ? (
        <div className="loading-spinner" />
      ) : following ? (
        <UserMinus className="action-icon" />
      ) : (
        <UserPlus className="action-icon" />
      )}
      {!iconOnly && <span>{following ? "Unfollow" : "Follow"}</span>}
    </button>
  );
}

export function UserAvatar({
  userId,
  userImage,
  size = "md",
}: {
  userId: string;
  userImage?: string;
  size?: "sm" | "md" | "lg";
}) {
  const storedUser = localStorage.getItem("user");
  let userName = "";
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      if (userData.id === userId) {
        userName = userData.name;
      }
    } catch {
      console.error('Error parsing user data');
    }
  }

  return <Avatar userId={userId} userName={userName} userImage={userImage} size={size} />;
}
