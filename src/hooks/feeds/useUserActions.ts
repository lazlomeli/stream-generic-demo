import { useState } from "react";
import { useUser } from "./useUser";
import { useFollowers } from "./useFollowers"
import { useToast } from "../../contexts/ToastContext";
import { refetchTimelineGlobal } from "./useFeedManager";

export function useUserActions(targetUserId: string) {
  const { user, client } = useUser();
  const { showError } = useToast();
  const {
    followers,
    loading: followersLoading,
    addFollower,
    removeFollower,
  } = useFollowers();
  const currentUserId = user?.nickname || "";
  const [loading, setLoading] = useState(false);
  const isFollowing = followers.includes(targetUserId);

  const handleFollow = async () => {

    if (targetUserId === currentUserId || !client) return;

    try {
      setLoading(true);

      if (isFollowing) {
        
        // Unfollow
        await client.unfollow({
          source: `timeline:${currentUserId}`,
          target: `user:${targetUserId}`,
        });
        removeFollower(targetUserId);
      } else {
        
        // Follow with notification enabled
        await client.follow({
          source: `timeline:${currentUserId}`,
          target: `user:${targetUserId}`,
          create_notification_activity: true,
        });
        
        addFollower(targetUserId);
        
      }
      refetchTimelineGlobal();
    } catch {
      showError("failed to perform this action");
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || followersLoading;
  const isOwnUser = targetUserId === currentUserId;

  return {
    isFollowing,
    isLoading,
    isOwnUser,
    handleFollow,
  };
}
