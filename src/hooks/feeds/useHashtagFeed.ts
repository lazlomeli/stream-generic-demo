import { useEffect, useState, useCallback } from "react";
import { ActivityResponse, Feed, FeedsClient } from "@stream-io/feeds-client";
import { useUser } from "./useUser";
import { useToast } from "../../contexts/ToastContext";

interface UseHashtagFeedOptions {
  limit?: number;
  watch?: boolean; 
  autoRetry?: boolean;
}

interface UseHashtagFeedReturn {
  activities: ActivityResponse[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  hashtag: string | undefined;
  feed: Feed | null;
}

export function useHashtagFeed(
  hashtag?: string,
  options: UseHashtagFeedOptions = {}
): UseHashtagFeedReturn {
  const {
    limit = 50,
    watch = true,
    autoRetry = false,
  } = options;

  const { client } = useUser();
  const { showError } = useToast();
  
  const [feed, setFeed] = useState<Feed | null>(null);
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!client || !hashtag) {
      setActivities([]);
      setFeed(null);
      setError(null);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    setIsLoading(true);
    setError(null);

    const loadFeed = async () => {
      try {
        // Normalize hashtag (lowercase, trim)
        const normalizedHashtag = hashtag.toLowerCase().trim();
        
        if (!normalizedHashtag) {
          throw new Error('Invalid hashtag');
        }

        // Create feed instance
        const hashtagFeed = client.feed("hashtag", normalizedHashtag);
        
        // Load initial data
        await hashtagFeed.getOrCreate({ 
          limit,
          watch,
        });

        if (!mounted) return;

        setFeed(hashtagFeed);

        // Get initial state
        const initialState = hashtagFeed.state.getLatestValue();

        // Subscribe to state changes for real-time updates
        unsubscribe = hashtagFeed.state.subscribeWithSelector(
          (state) => ({ 
            activities: state.activities,
            next: state.next,
          }),
          (state) => {
            if (mounted) {
              console.log('📱 Hashtag feed activities updated:', state.activities?.length);
              setActivities(state.activities || []);
              setHasMore(!!state.next);
            }
          }
        );

        setIsLoading(false);
      } catch (err: any) {
        console.error("Error loading hashtag feed:", err);
        
        if (!mounted) return;

        let errorMessage: string;

        // Handle specific error cases
        if (err?.message?.includes('Feed group with ID "hashtag" not found')) {
          errorMessage = 'Hashtag feature not configured. Please contact support.';
          console.error(
            '⚠️  SETUP REQUIRED: Create the "hashtag" feed group in your Stream dashboard or via server-side API:',
            '\n',
            'await streamClient.feeds.createFeedGroup({ id: "hashtag" })',
          );
        } else if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection.';
        } else {
          errorMessage = `Error loading #${hashtag} posts`;
        }
        
        setError(errorMessage);
        showError(errorMessage);
        setIsLoading(false);

        // Auto-retry logic
        if (autoRetry) {
          setTimeout(() => {
            if (mounted) {
              loadFeed();
            }
          }, 3000);
        }
      }
    };

    loadFeed();

    // Cleanup
    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [client, hashtag, limit, watch, autoRetry, showError]);

  // Refetch feed data
  const refetch = useCallback(async () => {
    if (!feed) return;

    setIsLoading(true);
    setError(null);
    
    try {
      await feed.getOrCreate({ limit });
      // State will update via subscription
    } catch (err: any) {
      const errorMsg = `Error refreshing #${hashtag} posts`;
      setError(errorMsg);
      showError(errorMsg);
      console.error("Error refetching hashtag feed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [feed, hashtag, limit, showError]);

  // Load more activities (pagination)
  const loadMore = useCallback(async () => {
    if (!feed || !hasMore || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await feed.getNextPage();
      // State will update via subscription
    } catch (err: any) {
      const errorMsg = 'Error loading more posts';
      setError(errorMsg);
      showError(errorMsg);
      console.error("Error loading more from hashtag feed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [feed, hasMore, isLoading, showError]);

  return {
    activities,
    isLoading,
    error,
    refetch,
    loadMore,
    hasMore,
    hashtag,
    feed,
  };
}

/**
 * Simpler version without real-time updates
 * Good for static pages or when you don't need live updates
 */
export function useHashtagFeedStatic(
  hashtag?: string,
  limit: number = 50
) {
  return useHashtagFeed(hashtag, { 
    limit, 
    watch: false 
  });
}

/**
 * Hook to check if hashtag feed group exists
 * Useful for feature flags or graceful degradation
 */
export function useHashtagFeatureAvailable(): boolean {
  const { client } = useUser();
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!client) return;

    const checkAvailability = async () => {
      try {
        const testFeed = client.feed("hashtag", "_test_");
        await testFeed.getOrCreate({ limit: 1 });
        setAvailable(true);
      } catch (error: any) {
        if (error?.message?.includes('Feed group with ID "hashtag" not found')) {
          setAvailable(false);
          console.warn('Hashtag feature is not available - feed group not configured');
        }
      }
    };

    checkAvailability();
  }, [client]);

  return available;
}