import { useEffect, useState, useCallback } from "react";
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

  // Get current activities based on feed type
  const activities =
    feedType === "timeline" ? timelineActivities : userActivities;

  // Initialize feeds ONCE - following the official react-sample-app pattern
  useEffect(() => {
    if (!client || !userId) return;

    let timelineUnsubscribe: () => void = () => {};
    let userUnsubscribe: () => void = () => {};

    const initFeeds = async () => {
      try {
        setLoading(true);

        // Create feed instances
        const timeline = client.feed("timeline", userId);
        const user = client.feed("user", userId);

        // Check if feeds already have activities (already initialized)
        const timelineState = timeline.state.getLatestValue();
        const userState = user.state.getLatestValue();
        
        const timelineAlreadyInitialized = typeof timelineState.activities !== 'undefined';
        const userAlreadyInitialized = typeof userState.activities !== 'undefined';

        // Only call getOrCreate if the feed hasn't been initialized yet
        if (!timelineAlreadyInitialized) {
          await timeline.getOrCreate({ watch: true });
        }
        
        if (!userAlreadyInitialized) {
          await user.getOrCreate({ watch: true });
        }

        // Set up subscriptions to listen for real-time updates
        timelineUnsubscribe = timeline.state.subscribe((state) => {
          setTimelineActivities(state.activities || []);
          queryClient.setQueryData(
            FEED_QUERY_KEYS.timeline(userId),
            state.activities || []
          );
        });

        userUnsubscribe = user.state.subscribe((state) => {
          setUserActivities(state.activities || []);
          queryClient.setQueryData(
            FEED_QUERY_KEYS.user(userId),
            state.activities || []
          );
        });

        // Get latest state after potential getOrCreate calls
        const latestTimelineState = timeline.state.getLatestValue();
        const latestUserState = user.state.getLatestValue();

        setTimelineActivities(latestTimelineState.activities || []);
        setUserActivities(latestUserState.activities || []);

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
      // Only unsubscribe from state updates
      // Don't stop watching - feeds should stay active
      timelineUnsubscribe?.();
      userUnsubscribe?.();
    };
  }, [client, userId, queryClient, showError]);

  // Handle feed type switching
  const switchFeedType = useCallback(
    (type: "timeline" | "user") => {
      if (type === feedType) return;
      setFeedType(type);
    },
    [feedType]
  );

  // For pagination - use getNextPage()
  const loadMoreTimeline = useCallback(async () => {
    if (!timelineFeed) return;
    try {
      await timelineFeed.getNextPage();
    } catch (error) {
      console.error("Error loading more timeline activities:", error);
      showError("Failed to load more activities");
    }
  }, [timelineFeed, showError]);

  const loadMoreUser = useCallback(async () => {
    if (!userFeed) return;
    try {
      await userFeed.getNextPage();
    } catch (error) {
      console.error("Error loading more user activities:", error);
      showError("Failed to load more activities");
    }
  }, [userFeed, showError]);

  return {
    timelineFeed,
    userFeed,
    activities,
    feedType,
    loading,
    switchFeedType,
    loadMoreTimeline,
    loadMoreUser,
  };
}