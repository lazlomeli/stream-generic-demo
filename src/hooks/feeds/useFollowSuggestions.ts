import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { User } from "@auth0/auth0-spa-js";
import { FullUserResponse } from "@stream-io/feeds-client";
import { FeedsClient } from "@stream-io/feeds-client";
import toast from "react-hot-toast";

// Query key for who to follow data
const WHO_TO_FOLLOW_QUERY_KEY = ["whoToFollow"];

const fetchWhoToFollowData = async (
    client: FeedsClient,
    user: User
  ): Promise<FullUserResponse[]> => {
    if (!client || !user) return [];
  
    try {
      // Option 1: Try getFollowSuggestions first
      const suggestions = await client.getFollowSuggestions({
        feed_group_id: "user",
        limit: 5,
      });
  
      let userIds: string[] = [];
  
      if (suggestions.suggestions.length > 0) {
        // Parse feed IDs to get user IDs
        userIds = suggestions.suggestions
          .map((s) => s.feed.split(':')[1])
          .filter((id): id is string => !!id)
          .slice(0, 5);
      } else {
        // Option 2: Fallback to getting all users (for small apps)
        const allUsers = await client.queryUsers({
          payload: {
            filter_conditions: {},
            limit: 5,
          },
        });
        
        // Filter out current user and limit to 5
        userIds = allUsers.users
          .filter((u) => u.id !== user.nickname)
          .map((u) => u.id)
          .slice(0, 5);
      }
  
      if (userIds.length === 0) {
        return [];
      }
  
      // Fetch full user details
      const usersResponse = await client.queryUsers({
        payload: {
          filter_conditions: {
            id: { $in: userIds },
          },
        },
      });
  
      return (usersResponse.users || []).slice(0, 5);
    } catch (error) {
      console.error("Error fetching who to follow:", error);
      toast.error("Error fetching who to follow");
      return [];
    }
  };

export function useFollowSuggestions() {
  const { client, user } = useUser();

  const {
    data: whoToFollow = [],
    isLoading,
    isFetching,
    error,
    refetch: fetchWhoToFollow,
  } = useQuery({
    queryKey: [...WHO_TO_FOLLOW_QUERY_KEY, user?.nickname],
    queryFn: () => fetchWhoToFollowData(client!, user!),
    enabled: !!client && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    whoToFollow,
    fetchWhoToFollow,
    isFetching,
    isLoading: isLoading || isFetching,
    error: error?.message || null,
  };
}