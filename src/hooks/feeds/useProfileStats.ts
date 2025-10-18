import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";

export interface FollowUser {
  id: string;
  name: string;
  image?: string;
}

// Query keys
const FOLLOWERS_QUERY_KEY = ["profile-followers"];
const FOLLOWING_QUERY_KEY = ["profile-following"];

// Get user name from activities
const getUserNameFromActivities = async (
  client: FeedsClient,
  userId: string
): Promise<string> => {
  try {
    const response = await client.queryActivities({
      filter: {
        user_id: userId,
      },
      limit: 1,
    });

    if (response.activities && response.activities.length > 0) {
      return response.activities[0].user?.name || `User ${userId.replace("user-", "")}`;
    }
    return `User ${userId.replace("user-", "")}`;
  } catch (error) {
    console.error("Error fetching user name:", error);
    return `User ${userId.replace("user-", "")}`;
  }
};

// Fetch followers for a user
const fetchFollowers = async (
  client: FeedsClient,
  userId: string
): Promise<FollowUser[]> => {
  if (!client || !userId) return [];

  try {
    console.log("Fetching followers for user:", userId);
    const response = await client.queryFollows({
      filter: {
        target_feed: `user:${userId}`,
      },
      limit: 50,
    });

    console.log("Followers response:", response.follows.length, "follows");

    const followers = await Promise.all(
      response.follows.map(async (follow) => {
        const sourceFeedId = follow.source_feed.id;
        const followerUserId = sourceFeedId.replace("user:", "");
        const userName = await getUserNameFromActivities(client, followerUserId);
        
        console.log("Follower:", followerUserId, "->", userName);
        
        return {
          id: followerUserId,
          name: userName,
          image: undefined,
        };
      })
    );

    // Filter out duplicates and current user
    const uniqueFollowers = followers
      .filter((follower, index, self) => 
        index === self.findIndex(f => f.id === follower.id) && 
        follower.id !== userId
      );

    console.log("Final followers:", uniqueFollowers.length);
    return uniqueFollowers;
  } catch (error) {
    console.error("Error fetching followers:", error);
    return [];
  }
};

// Fetch following for a user
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

    const following = await Promise.all(
      response.follows.map(async (follow) => {
        const targetFeedId = follow.target_feed.id;
        const followedUserId = targetFeedId.replace("user:", "");
        const userName = await getUserNameFromActivities(client, followedUserId);
        
        return {
          id: followedUserId,
          name: userName,
          image: undefined,
        };
      })
    );

    return following.filter((user) => user.id !== userId); // Filter out the current user
  } catch (error) {
    console.error("Error fetching following:", error);
    return [];
  }
};

// Follow a user
const followUser = async (
  client: FeedsClient,
  sourceUserId: string,
  targetUserId: string,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): Promise<void> => {
  if (!client || !sourceUserId || !targetUserId) return;
  
  console.log('client', client);
  console.log('sourceUserId', sourceUserId);
  console.log('targetUserId', targetUserId);
  console.log('source', `timeline:${sourceUserId}`);
  console.log('target', `user:${targetUserId}`);
  console.log('create_notification_activity', true);

  try {
    // const existingFollows = await client.queryFollows({
    //   filter: {
    //     source_feed: `timeline:${sourceUserId}`,
    //     target_feed: `user:${targetUserId}`,
    //   },
    // });
  
    // if (existingFollows.follows.length > 0) {
    //   console.log('Follow already exists, skipping...');
    //   toast.success("Already following this user");
    //   return;
    // }
    
    await client.follow({
      source: `timeline:${sourceUserId}`,
      target: `user:${targetUserId}`,
      create_notification_activity: true,
    });
    console.log('555');
    showSuccess("Successfully followed user");
  } catch (error: any) {
    if (error.code === 4 && error.message?.includes('already exists')) {
      console.log('Follow already exists (caught error)');
      showSuccess("Already following this user");
      return;
    }
    
    showError("Error following user");
    throw error;
  }
};

// Unfollow a user
const unfollowUser = async (
  client: FeedsClient,
  sourceUserId: string,
  targetUserId: string,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): Promise<void> => {
  if (!client || !sourceUserId || !targetUserId) return;

  console.log('[unfollowUser] sourceUserId', sourceUserId);
  console.log('[unfollowUser] targetUserId', targetUserId);
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

  // console.log('targetUserId', targetUserId); -> el usuario que quiero seguir (mismo que userId)
  // console.log('user', user); -> soy yo

  // Query for followers
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

  // Query for following
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

  // Query for current user's following (to check if current user is following target user)
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

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      console.log('entra aqui?', user); // esta pillando el mismo usuario en vez del otro
      if (!user?.nickname) throw new Error("User not authenticated");
      console.log('y aqui?');
      return followUser(client!, user.nickname, targetUserId, showSuccess, showError);
    },
    onSuccess: () => {
      // Invalidate and refetch followers/following data
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

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.nickname) throw new Error("User not authenticated");
      return unfollowUser(client!, user.nickname, targetUserId, showSuccess, showError);
    },
    onSuccess: () => {
      // Invalidate and refetch followers/following data
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

  // Check if current user is following target user
  const isFollowing = (targetUserId: string): boolean => {
    if (!user?.nickname) return false;
    // Check if the current user is following the target user
    return currentUserFollowing.some((followedUser) => followedUser.id === targetUserId);
  };

  // Check if target user is following current user
  const isFollowedBy = (targetUserId: string): boolean => {
    if (!user?.nickname) return false;
    // Check if the target user is following the current user
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