import { useUser } from "./useUser";
import { Feed } from "@stream-io/feeds-client";
import { 
  useNotificationStatus,
  useFeedActivities,  // Changed from useAggregatedActivities
} from "@stream-io/feeds-client/react-bindings";
import { useToast } from "../../contexts/ToastContext";
import { useEffect, useState } from "react";


let isInitializing = false;
let globalFeed: Feed | null = null;
const subscribers = new Set<() => void>();

function subscribeToGlobalFeed(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers() {
  subscribers.forEach(callback => callback());
}

export function useNotifications() {
  const { client, user, isReady } = useUser();
  const { showError } = useToast();
  const [feed, setFeed] = useState<Feed | null>(globalFeed);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = subscribeToGlobalFeed(() => {
      console.log('🔔 Global feed changed, syncing local state');
      if (globalFeed && !feed) {
        setFeed(globalFeed);
        forceUpdate({});
      }
    });
    return unsubscribe;
  }, [feed]);

  useEffect(() => {

    if (globalFeed) { if (!feed) setFeed(globalFeed); return; }

    if (isInitializing) return;

    if (!isReady || !client || !user?.nickname) return;
   

    isInitializing = true;

    const notificationFeed = client.feed("notification", user.nickname);
    
    notificationFeed
      .getOrCreate({ 
        watch: true,
        limit: 20
      })
      .then(() => {
        globalFeed = notificationFeed;
        setFeed(notificationFeed);
        notifySubscribers();
      })
      .catch((error) => {
        showError("Error setting up notifications");
      })
      .finally(() => {
        isInitializing = false;
      });
  }, [isReady, client, user?.nickname, feed, showError]);

  // Use SDK's built-in hooks (convert null to undefined for proper typing)
  const notificationStatus = useNotificationStatus(feed || undefined);
  const activitiesData = useFeedActivities(feed || undefined);  // Changed from useAggregatedActivities

  const unreadCount = notificationStatus?.unseen || notificationStatus?.unread || 0;

  const markAsSeen = async () => {
    if (!client || !feed || !user) return;

    try {
      await client.markActivity({
        feed_group_id: feed.group,
        feed_id: feed.id,
        mark_all_seen: true,
        mark_all_read: true,
      });
    } catch (error) {
      console.error("Error marking notifications as seen:", error);
      showError("Error marking notifications as seen");
    }
  };

  const isLoading = !feed || activitiesData?.is_loading || false;

  return {
    notifications: activitiesData?.activities || [],  // Changed to return flat activities
    isLoading,
    error: null,
    unreadCount,
    markAsSeen,
  };
}