import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";

export interface FollowUser {
  id: string;
  name: string;
  image?: string;
}

const FOLLOWERS_QUERY_KEY = ["profile-followers"];
const FOLLOWING_QUERY_KEY = ["profile-following"];

const fetchFollowers = async (
  client: FeedsClient,
  userId: string
): Promise<FollowUser[]> => {
  if (!client || !userId) return [];

  try {
    const response = await client.queryFollows({
      filter: {
        target_feed: `user:${userId}`,
      },
      limit: 50,
    });

    // Extract user info directly from the response - no additional API calls needed!
    const followers = response.follows.map((follow) => {
      const sourceFeedId = follow.source_feed.id;
      const followerUserId = sourceFeedId.replace("user:", "");
      
      // Get name from the feed's created_by user, or fall back to feed name or user ID
      const userName = 
        follow.source_feed.created_by?.name || 
        follow.source_feed.name || 
        `User ${followerUserId}`;
      
      const userImage = follow.source_feed.created_by?.image;
      
      return {
        id: followerUserId,
        name: userName,
        image: userImage,
      };
    });

    // Filter out duplicates and self-follows
    const uniqueFollowers = followers.filter(
      (follower, index, self) => 
        index === self.findIndex(f => f.id === follower.id) && 
        follower.id !== userId
    );

    return uniqueFollowers;
  } catch (error) {
    console.error("Error fetching followers:", error);
    return [];
  }
};

const fetchFollowing = async (
  client: FeedsClient,
  userId: string
): Promise<FollowUser[]> => {
  if (!client || !userId) return [];

  try {
    const response = await client.queryFollows({
      filter: {
        source_feed: `timeline:${userId}`,
      },
      limit: 50,
    });

    // Extract user info directly from the response - no additional API calls needed!
    const following = response.follows.map((follow) => {
      const targetFeedId = follow.target_feed.id;
      const followedUserId = targetFeedId.replace("user:", "");
      
      // Get name from the feed's created_by user, or fall back to feed name or user ID
      const userName = 
        follow.target_feed.created_by?.name || 
        follow.target_feed.name || 
        `User ${followedUserId}`;
      
      const userImage = follow.target_feed.created_by?.image;
      
      return {
        id: followedUserId,
        name: userName,
        image: userImage,
      };
    });

    return following.filter((user) => user.id !== userId);
  } catch (error) {
    console.error("Error fetching following:", error);
    return [];
  }
};

const followUser = async (
  client: FeedsClient,
  sourceUserId: string,
  targetUserId: string,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): Promise<void> => {
  if (!client || !sourceUserId || !targetUserId) return;

  try {
    await client.follow({
      source: `timeline:${sourceUserId}`,
      target: `user:${targetUserId}`,
      create_notification_activity: true,
    });
    showSuccess("Successfully followed user");
  } catch (error: any) {
    if (error.code === 4 && error.message?.includes('already exists')) {
      showSuccess("Already following this user");
      return;
    }
    
    showError("Error following user");
    throw error;
  }
};

const unfollowUser = async (
  client: FeedsClient,
  sourceUserId: string,
  targetUserId: string,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): Promise<void> => {
  if (!client || !sourceUserId || !targetUserId) return;

  try {
    await client.unfollow({
      source: `timeline:${sourceUserId}`,
      target: `user:${targetUserId}`,
    });
    showSuccess("Successfully unfollowed user");
  } catch (error) {
    console.error("Error unfollowing user:", error);
    showError("Error unfollowing user");
    throw error;
  }
};

export function useProfileStats(userId?: string) {
  const { client, user } = useUser();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.nickname;

  const {
    data: followers = [],
    isLoading: followersLoading,
    error: followersError,
    refetch: refetchFollowers,
  } = useQuery({
    queryKey: [...FOLLOWERS_QUERY_KEY, targetUserId],
    queryFn: () => fetchFollowers(client!, targetUserId!),
    enabled: !!client && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: following = [],
    isLoading: followingLoading,
    error: followingError,
    refetch: refetchFollowing,
  } = useQuery({
    queryKey: [...FOLLOWING_QUERY_KEY, targetUserId],
    queryFn: () => fetchFollowing(client!, targetUserId!),
    enabled: !!client && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: currentUserFollowing = [],
    isLoading: currentUserFollowingLoading,
  } = useQuery({
    queryKey: [...FOLLOWING_QUERY_KEY, user?.nickname],
    queryFn: () => fetchFollowing(client!, user?.nickname!),
    enabled: !!client && !!user?.nickname && !!targetUserId && user.nickname !== targetUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.nickname) throw new Error("User not authenticated");
      return followUser(client!, user.nickname, targetUserId, showSuccess, showError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWERS_QUERY_KEY, targetUserId],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWING_QUERY_KEY, targetUserId],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWERS_QUERY_KEY, user?.nickname],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWING_QUERY_KEY, user?.nickname],
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.nickname) throw new Error("User not authenticated");
      return unfollowUser(client!, user.nickname, targetUserId, showSuccess, showError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWERS_QUERY_KEY, targetUserId],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWING_QUERY_KEY, targetUserId],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWERS_QUERY_KEY, user?.nickname],
      });
      queryClient.invalidateQueries({
        queryKey: [...FOLLOWING_QUERY_KEY, user?.nickname],
      });
    },
  });

  const isFollowing = (targetUserId: string): boolean => {
    if (!user?.nickname) return false;
    return currentUserFollowing.some((followedUser) => followedUser.id === targetUserId);
  };

  const isFollowedBy = (targetUserId: string): boolean => {
    if (!user?.nickname) return false;
    return followers.some((follower) => follower.id === targetUserId);
  };

  return {
    followers,
    following,
    isLoading: followersLoading || followingLoading || currentUserFollowingLoading,
    error: followersError || followingError,
    followUser: followMutation.mutate,
    unfollowUser: unfollowMutation.mutate,
    isFollowing,
    isFollowedBy,
    refetchFollowers,
    refetchFollowing,
    isFollowingLoading: followMutation.isPending,
    isUnfollowingLoading: unfollowMutation.isPending,
  };
}