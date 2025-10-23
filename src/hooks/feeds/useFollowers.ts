import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { FeedsClient, FollowResponse } from "@stream-io/feeds-client";

const FOLLOWERS_QUERY_KEY = ["followers"];

const fetchFollowers = async (
  client: FeedsClient,
  userId: string
): Promise<string[]> => {
  const response = await client.queryFollows({
    filter: {
      source_feed: `timeline:${userId}`,
    },
  });

  return response.follows.map(
    (follow: FollowResponse) => follow.target_feed.id
  );
};

export function useFollowers() {
  const { user, client } = useUser();
  const queryClient = useQueryClient();

  const {
    data: followers = [],
    isLoading: loading,
    error,
    refetch: refreshFollowers,
  } = useQuery({
    queryKey: [...FOLLOWERS_QUERY_KEY, user?.nickname],
    queryFn: () => {
      if (!client) {
        throw new Error("Client is not available");
      }
      return fetchFollowers(client, user?.nickname!);
    },
    enabled: !!client && !!user?.nickname,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const addFollowerMutation = useMutation({
    mutationFn: async (userId: string) => {
      queryClient.setQueryData(
        [...FOLLOWERS_QUERY_KEY, user?.nickname],
        (old: string[] = []) => [...old, userId]
      );
      return userId;
    },
    onError: () => {      
      refreshFollowers();
    },
  });

  const removeFollowerMutation = useMutation({
    mutationFn: async (userId: string) => {
      queryClient.setQueryData(
        [...FOLLOWERS_QUERY_KEY, user?.nickname],
        (old: string[] = []) => old.filter((id) => id !== userId)
      );
      return userId;
    },
    onError: () => {
      refreshFollowers();
    },
  });

  const addFollower = (userId: string) => {
    addFollowerMutation.mutate(userId);
  };

  const removeFollower = (userId: string) => {
    removeFollowerMutation.mutate(userId);
  };

  return {
    followers,
    loading,
    error: error?.message || null,
    refreshFollowers,
    addFollower,
    removeFollower,
  };
}
