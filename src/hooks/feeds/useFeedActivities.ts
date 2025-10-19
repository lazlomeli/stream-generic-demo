import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Feed, ActivityResponse } from "@stream-io/feeds-client";
import { useUser } from "./useUser";
import { useToast } from "../../contexts/ToastContext";

// Query keys for feeds
const FEED_QUERY_KEYS = {
  timeline: (userId: string) => ["feed", "timeline", userId],
  user: (userId: string) => ["feed", "user", userId],
  activities: (userId: string, feedType: string) => [
    "feed",
    "activities",
    userId,
    feedType,
  ],
} as const;

export function useFeedActivities() {
  const { client, user } = useUser();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.nickname || "";
  const [timelineFeed, setTimelineFeed] = useState<Feed | null>(null);
  const [userFeed, setUserFeed] = useState<Feed | null>(null);
  const [timelineActivities, setTimelineActivities] = useState<
    ActivityResponse[]
  >([]);
  const [userActivities, setUserActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<"timeline" | "user">("timeline");
  const feedTypeRef = useRef(feedType);

  // Update ref when feedType changes
  useEffect(() => {
    feedTypeRef.current = feedType;
  }, [feedType]);

  // Get current activities based on feed type
  const activities =
    feedType === "timeline" ? timelineActivities : userActivities;

  // Initialize feeds
  useEffect(() => {
    if (!client || !userId) return;

    let timelineUnsubscribe: () => void = () => {};
    let userUnsubscribe: () => void = () => {};

    const initFeeds = async () => {
      try {
        setLoading(true);

        // Initialize feeds
        // - timeline: Aggregates activities from people you follow (NOT yourself)
        // - user: Your own posts
        const timeline = client.feed("timeline", userId);
        const user = client.feed("user", userId);

        // Initialize feeds sequentially to avoid concurrent getOrCreate calls
        await timeline.getOrCreate({ watch: true });
        await user.getOrCreate({ watch: true });

        // CLEANUP: Remove self-follow if it exists (from old code)
        // console.log('🔍 Checking for self-follow relationship...');
        // try {
        //   const follows = await client.queryFollows({
        //     filter: {
        //       source_feed: timeline.feed,
        //       target_feed: { $in: [user.feed] },
        //     },
        //   });
          
        //   if (follows.follows.length > 0) {
        //     console.log('❌ Found self-follow! Removing it...', follows.follows);
        //     await client.unfollow({
        //       source: timeline.feed,
        //       target: user.feed,
        //     });
        //     console.log('✅ Self-follow removed successfully!');
            
        //     await timeline.getOrCreate();
        //   } else {
        //     console.log('✅ No self-follow found - timeline is clean!');
        //   }
        // } catch (err) {
        //   console.error('Error checking/removing self-follow:', err);
        // }

        // console.log('📊 Timeline feed info:', {
        //   feed: timeline.feed,
        //   userId,
        // });

        // Set up subscriptions for both feeds
        timelineUnsubscribe = timeline.state.subscribe((state) => {
          console.log('📥 Timeline activities update:', state.activities?.length);
          setTimelineActivities(state.activities || []);
          // Update React Query cache when real-time updates come in
          queryClient.setQueryData(
            FEED_QUERY_KEYS.timeline(userId),
            state.activities || []
          );
        });

        userUnsubscribe = user.state.subscribe((state) => {
          console.log('📥 User activities update:', state.activities?.length);
          setUserActivities(state.activities || []);
          // Update React Query cache when real-time updates come in
          queryClient.setQueryData(
            FEED_QUERY_KEYS.user(userId),
            state.activities || []
          );
        });

        // Set initial activities from current state
        const timelineState = timeline.state.getLatestValue();
        setTimelineActivities(timelineState.activities || []);

        const userState = user.state.getLatestValue();
        setUserActivities(userState.activities || []);

        // Log activities with actors for debugging
        console.log('👤 Your user ID:', userId);
        console.log('📝 Timeline activities actors:', 
          timelineState.activities?.map(a => a.user.id) || []
        );

        setTimelineFeed(timeline);
        setUserFeed(user);
      } catch (err) {
        console.error("Error initializing feeds:", err);
        showError("Error initializing feeds");
      } finally {
        setLoading(false);
      }
    };

    initFeeds();

    return () => {
      // Only unsubscribe from state updates, don't close the feeds
      // This allows the feeds to continue running in the background
      timelineUnsubscribe?.();
      userUnsubscribe?.();
    };
  }, [client, userId, queryClient, showError]);

  // Handle feed type switching
  const switchFeedType = useCallback(
    async (type: "timeline" | "user") => {
      if (!client || type === feedType) return;

      try {
        setLoading(true);
        setFeedType(type);
      } catch (err) {
        console.error("Error switching feed type:", err);
        showError("failed to switch feed type");
      } finally {
        setLoading(false);
      }
    },
    [client, feedType, showError]
  );

  // Manual refetch functions that work with existing feeds
  const refetchTimeline = useCallback(async () => {
    if (!timelineFeed) return;
    try {
      await timelineFeed.getOrCreate();
      showSuccess("Timeline refreshed successfully!");
    } catch (error) {
      console.error("Error refetching timeline:", error);
      showError("Failed to refresh timeline");
    }
  }, [timelineFeed, showSuccess, showError]);

  const refetchUser = useCallback(async () => {
    if (!userFeed) return;
    try {
      await userFeed.getOrCreate();
      showSuccess("User feed refreshed successfully!");
    } catch (error) {
      console.error("Error refetching user feed:", error);
      showError("Failed to refresh user feed");
    }
  }, [userFeed, showSuccess, showError]);

  const refetchAllFeeds = useCallback(async () => {
    try {
      // Refetch feeds sequentially to avoid concurrent getOrCreate calls
      if (timelineFeed) {
        await timelineFeed.getOrCreate();
      }
      if (userFeed) {
        await userFeed.getOrCreate();
      }
      showSuccess("All feeds refreshed successfully!");
    } catch (error) {
      console.error("Error refetching feeds:", error);
      showError("Failed to refresh feeds");
    }
  }, [timelineFeed, userFeed, showSuccess, showError]);

  return {
    timelineFeed,
    userFeed,
    activities,
    feedType,
    loading,
    switchFeedType,
    // React Query refetch functions
    refetchTimeline,
    refetchUser,
    refetchAllFeeds,
  };
}