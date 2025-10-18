import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";
import { useUser } from "./useUser";

const addActivityToFeed = async (
    client: FeedsClient,
    userId: string,
    text: string
  ): Promise<void> => {
    const userFeed = client.feed("user", userId);
    await userFeed.addActivity({
      type: "post",
      text,
    });
  
    // Note: We don't need to call getOrCreate here anymore since the global feed manager
    // will handle the real-time updates through subscriptions
  };

  const deleteActivityFromFeed = async (
    client: FeedsClient,
    activityId: string
  ): Promise<void> => {
    await client.deleteActivity({
      id: activityId,
    });
  };

  export function useFeedActions() {
    const { client, user } = useUser();
    const { showSuccess, showError } = useToast();
    const queryClient = useQueryClient();
    const userId = user?.nickname || "";
  
    // Mutation for creating a post
    const createPostMutation = useMutation({
      mutationFn: async (text: string) => {
        if (!client || !userId) {
          console.log('client', client);
          console.log('userId', userId);
          throw new Error("Client or user not available");
        }
        return await addActivityToFeed(client, userId, text);
      },
      onSuccess: () => {
        // Invalidate all feed-related queries to trigger refetches
        queryClient.invalidateQueries({
          queryKey: ["feed"],
        });
        showSuccess("Activity created successfully!");
      },
      onError: (error) => {
        console.error("Error posting:", error);
        showError("Failed to create activity");
      },
    });
  
    // Mutation for deleting a post
    const deletePostMutation = useMutation({
      mutationFn: async (activityId: string) => {
        if (!client) {
          throw new Error("Client not available");
        }
        return await deleteActivityFromFeed(client, activityId);
      },
      onSuccess: () => {
        // Invalidate all feed-related queries to trigger refetches
        queryClient.invalidateQueries({
          queryKey: ["feed"],
        });
        showSuccess("Activity deleted successfully");
      },
      onError: (error) => {
        console.error("Error deleting activity:", error);
        showError("Failed to delete activity");
      },
    });
  
    // Manual refetch mutation - just invalidate cache instead of calling getOrCreate
    const refetchFeedsMutation = useMutation({
      mutationFn: async () => {
        if (!client || !userId) {
          throw new Error("Client or user not available");
        }
        // Don't call getOrCreate here to avoid conflicts
        // Just return success to trigger cache invalidation
        return true;
      },
      onSuccess: () => {
        // Invalidate all feed-related queries
        queryClient.invalidateQueries({
          queryKey: ["feed"],
        });
        showSuccess("Feeds refreshed successfully!");
      },
      onError: (error) => {
        console.error("Error refetching feeds:", error);
        showError("Failed to refresh feeds");
      },
    });
  
    const handlePost = async (text: string) => {
      createPostMutation.mutate(text);
    };
  
    const handleDeleteActivity = async (activityId: string) => {
      deletePostMutation.mutate(activityId);
    };
  
    const handleRefetchFeeds = async () => {
      refetchFeedsMutation.mutate();
    };
  
    return {
      posting: createPostMutation.isPending,
      deleting: deletePostMutation.isPending,
      refetching: refetchFeedsMutation.isPending,
      handlePost,
      handleDeleteActivity,
      handleRefetchFeeds,
      // Expose mutation states for more granular control
      createPostMutation,
      deletePostMutation,
      refetchFeedsMutation,
    };
  }