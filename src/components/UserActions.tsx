import { UserPlus, UserMinus } from "lucide-react";
import { Avatar } from "./Avatar";
import "./UserActions.css";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { useUser } from "../hooks/feeds/useUser";

interface UserActionsProps {
  targetUserId: string;
}

export function UserActions({ targetUserId }: UserActionsProps) {
  const { user } = useUser();
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
      className={`user-action-button ${following ? "following" : ""}`}
    >
      {isLoading ? (
        <div className="loading-spinner" />
      ) : following ? (
        <UserMinus className="action-icon" />
      ) : (
        <UserPlus className="action-icon" />
      )}
      <span>{following ? "Unfollow" : "Follow"}</span>
    </button>
  );
}

export function UserAvatar({
  userId,
  size = "md",
}: {
  userId: string;
  size?: "sm" | "md" | "lg";
}) {
  // Try to find user by ID to get their name for initials
  const storedUser = localStorage.getItem("user");
  let userName = "";
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      if (userData.id === userId) {
        userName = userData.name;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return <Avatar userId={userId} userName={userName} size={size} />;
}
