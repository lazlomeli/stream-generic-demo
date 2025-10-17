import { useUser } from "./useUser";
import {
  GetOrCreateFeedResponse,
  NotificationStatusResponse,
  StreamResponse,
} from "@stream-io/feeds-client";
import { Feed } from "@stream-io/feeds-client";
import toast from "react-hot-toast";
import { useEffect, useState, useRef, useCallback } from "react";

interface NotificationsResponse
  extends StreamResponse<GetOrCreateFeedResponse> {
  notification_status?: NotificationStatusResponse;
}

export function useNotifications() {
  const { client, user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsData, setNotificationsData] = useState<NotificationsResponse | null>(null);
  const notificationsFeedRef = useRef<Feed | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Store client and user in refs to access in callbacks without dependencies
  const clientRef = useRef(client);
  const userRef = useRef(user);
  
  useEffect(() => {
    clientRef.current = client;
    userRef.current = user;
  }, [client, user]);

  // Use primitive values as dependencies - they won't change unless the actual user changes
  console.log('FUERA user', user);
  console.log('FUERA client', client);

  const userId = user?.nickname;
  const hasClient = !!client;

  useEffect(() => {
    if (!hasClient || !userId) {
        console.log('hasClient', hasClient);
        console.log('userId', userId);
      console.log("Skipping setup: no client or user ID");
      return;
    }

    // If we already have a feed for this user, don't reinitialize
    if (notificationsFeedRef.current?.id === userId) {
      console.log("Feed already initialized for this user, skipping setup");
      return;
    }

    console.log("Setting up notifications feed for user:", userId);

    const setupNotifications = async () => {
      try {
        const currentClient = clientRef.current;
        const currentUser = userRef.current;
        
        if (!currentClient || !currentUser) return;


        console.log('currentClient', currentClient);
        console.log('currentUser', currentUser);

        // Create the notification feed
        const feed = currentClient.feed("notification", currentUser.nickname as string);
        notificationsFeedRef.current = feed;

        // Get or create with watch enabled for real-time updates
        const initialData = await feed.getOrCreate({ watch: true });
        console.log("Initial notification data:", initialData);
        
        setNotificationsData(initialData);
        setUnreadCount(initialData.notification_status?.unread || 0);

        // Clean up any existing subscription before creating a new one
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        // Subscribe to state changes for real-time updates
        const unsubscribe = feed.state.subscribe((state) => {
          console.log("Notification feed state updated:", state);
          
          // Update unread count
          const newUnreadCount = state.notification_status?.unread || 0;
          setUnreadCount(newUnreadCount);

          // Update the full notifications data
          setNotificationsData((prev) => ({
            ...prev,
            activities: state.activities,
            aggregated_activities: state.aggregated_activities,
            notification_status: state.notification_status,
            duration: prev?.duration || "",
          } as NotificationsResponse));
        });

        unsubscribeRef.current = unsubscribe;

        // Listen to specific notification events and update state
        feed.on('feeds.notification_feed.updated', (event) => {          
          // Refetch to get the latest notification status
          feed.getOrCreate({ watch: false }).then((updatedData) => {
            setUnreadCount(updatedData.notification_status?.unread || 0);
            setNotificationsData(updatedData);
          }).catch((err) => {
            console.error('Error refetching notifications:', err);
          });
        });

      } catch (error) {
        console.error("Error setting up notifications:", error);
        toast.error("Error setting up notifications");
      }
    };

    setupNotifications();

    // Cleanup only unsubscribes, doesn't reset anything
    return () => {
      console.log("Cleanup: unsubscribing from notifications");
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [hasClient, userId]); // Only re-run if user ID changes or client availability changes

  // Mark notifications as seen
  const markAsSeen = useCallback(async () => {
    const currentClient = clientRef.current;
    const currentUser = userRef.current;
    const feed = notificationsFeedRef.current;
    
    if (!currentClient || !currentUser || !feed) return;

    try {
      // Mark all notifications as seen and read
      await currentClient.markActivity({
        feed_group_id: feed.group,
        feed_id: feed.id,
        mark_all_seen: true,
        mark_all_read: true,
      });
      
      // Update local state immediately
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as seen:", error);
      toast.error("Error marking notifications as seen");
    }
  }, []); // No dependencies - uses refs

  const isLoading = !notificationsData && hasClient && !!userId;

  return {
    notifications: notificationsData,
    isLoading,
    error: null,
    unreadCount,
    markAsSeen,
  };
}