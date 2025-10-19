import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { ActivityResponse } from "@stream-io/feeds-client";
import { FeedsClient } from "@stream-io/feeds-client";
import toast from "react-hot-toast";

// Query key for popular activities data
const POPULAR_QUERY_KEY = ["popular"];

// Calculate popularity score with weighted metrics
const getPopularityScore = (activity: ActivityResponse) => {
  // Use the built-in counts from ActivityResponse
  const reactions = activity.reaction_count || 0; // Total reactions (likes, etc.)
  const comments = activity.comment_count || 0;
  const bookmarks = activity.bookmark_count || 0;
  const shares = activity.share_count || 0;
  
  // Weight different engagement types
  // Comments = highest value (most engagement)
  // Bookmarks = medium value (intent to revisit)
  // Reactions = base value
  // Shares = high value (amplification)
  const engagementScore = 
    reactions + 
    (comments * 5) + 
    (bookmarks * 2) + 
    (shares * 4);
  
  // Add recency boost (newer posts get a boost)
  const ageInHours = activity.created_at 
    ? (Date.now() - new Date(activity.created_at).getTime()) / (1000 * 60 * 60)
    : 0;
  
  // Posts within 48 hours get a recency boost
  const recencyBoost = Math.max(0, 48 - ageInHours) / 48;
  
  // Final score: engagement + 50% boost for recent posts
  return engagementScore * (1 + (recencyBoost * 0.5));
};

const fetchPopularActivities = async (
  client: FeedsClient
): Promise<ActivityResponse[]> => {
  if (!client) return [];

  try {
    // Query all activities across feeds
    const response = await client.queryActivities({
      filter: {
        activity_type: 'post', // Only fetch posts
      },
      limit: 100, // Fetch more to have better trending options
    });

    // Sort by popularity score (highest first)
    const sortedActivities = [...response.activities].sort((a, b) => {
      return getPopularityScore(b) - getPopularityScore(a);
    });

    // Return top 50 most popular
    return sortedActivities.slice(0, 50);
  } catch (error) {
    console.error("Error fetching popular activities:", error);
    toast.error("Error fetching popular activities");
    return [];
  }
};

export function usePopularActivities() {
  const { client, user } = useUser();

  const {
    data: popularActivities = [],
    isLoading,
    isFetching,
    error,
    refetch: fetchPopular,
  } = useQuery({
    queryKey: [...POPULAR_QUERY_KEY, user?.nickname],
    queryFn: () => {
      if (!client) {
        throw new Error("Client is not available");
      }
      return fetchPopularActivities(client);
    },
    enabled: !!client && !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes for fresh trending
  });

  return {
    popularActivities,
    fetchPopular,
    isFetching,
    isLoading: isLoading || isFetching,
    error: error?.message || null,
  };
}