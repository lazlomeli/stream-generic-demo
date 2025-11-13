import { useState, useCallback } from 'react';
import { useUser } from './feeds/useUser';

export const usePinActivity = (feedGroup: string, feedId: string) => {
  const { client } = useUser();
  const [isPinning, setIsPinning] = useState(false);
  const [isUnpinning, setIsUnpinning] = useState(false);

  const pinActivity = useCallback(
    async (activityId: string) => {
      if (!client) return;
      
      setIsPinning(true);
      try {
        await client.pinActivity({
          feed_group_id: feedGroup,
          feed_id: feedId,
          activity_id: activityId,
        });
      } catch (error) {
        console.error('Error pinning activity:', error);
      } finally {
        setIsPinning(false);
      }
    },
    [client, feedGroup, feedId]
  );

  const unpinActivity = useCallback(
    async (activityId: string) => {
      if (!client) return;
      
      setIsUnpinning(true);
      try {
        await client.unpinActivity({
          feed_group_id: feedGroup,
          feed_id: feedId,
          activity_id: activityId,
        });
      } catch (error) {
        console.error('Error unpinning activity:', error);
      } finally {
        setIsUnpinning(false);
      }
    },
    [client, feedGroup, feedId]
  );

  return {
    pinActivity,
    unpinActivity,
    isPinning,
    isUnpinning,
  };
};