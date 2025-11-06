import { useState, useEffect } from 'react';
import { useUser } from './useUser';
import { extractHashtags } from '../../utils/hashtagUtils';

export interface TrendingHashtag {
  hashtag: string;
  count: number;
}

export function useTrendingHashtags(limit: number = 5) {
  const { client } = useUser();
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) {
      setHashtags([]);
      return;
    }

    let mounted = true;

    const fetchTrendingHashtags = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Query all recent activities
        const response = await client.queryActivities({
          filter: {
            activity_type: 'post',
          },
          limit: 100, // Fetch more activities to get better hashtag data
        });

        if (!mounted) return;
        // Extract hashtags and count occurrences
        const hashtagCount = new Map<string, number>();

        response.activities.forEach((activity) => {
          if (activity.text) {
            const activityHashtags = extractHashtags(activity.text);
            if (activityHashtags.length > 0) {
            }
            activityHashtags.forEach((hashtag) => {
              const count = hashtagCount.get(hashtag) || 0;
              hashtagCount.set(hashtag, count + 1);
            });
          }
        });

        // Convert to array and sort by count
        const sortedHashtags: TrendingHashtag[] = Array.from(hashtagCount.entries())
          .map(([hashtag, count]) => ({ hashtag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        
        setHashtags(sortedHashtags);
      } catch (err: any) {
        setError('Failed to fetch trending hashtags');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTrendingHashtags();

    return () => {
      mounted = false;
    };
  }, [client, limit]);

  return {
    hashtags,
    isLoading,
    error,
  };
}

