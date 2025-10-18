import { useUser } from "./useUser";
import {
  GetOrCreateFeedResponse,
  NotificationStatusResponse,
  StreamResponse,
} from "@stream-io/feeds-client";
import { Feed } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";
import { useEffect, useState, useRef, useCallback } from "react";

interface NotificationsResponse
  extends StreamResponse<GetOrCreateFeedResponse> {
  notification_status?: NotificationStatusResponse;
}

export function useNotifications() {
  const { client, user } = useUser();
  const { showError } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsData, setNotificationsData] = useState<NotificationsResponse | null>(null);
  const notificationsFeedRef = useRef<Feed | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const eventListenerRef = useRef<((event: any) => void) | null>(null);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  
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
        console.log("Initial notification_status:", initialData.notification_status);
        
        setNotificationsData(initialData);
        const initialUnseen = initialData.notification_status?.unseen || 0;
        const initialUnread = initialData.notification_status?.unread || 0;
        const initialCount = initialUnseen || initialUnread;
        console.log("Initial unseenCount:", initialUnseen, "unreadCount:", initialUnread, "using:", initialCount);
        setUnreadCount(initialCount);

        // Clean up any existing subscription before creating a new one
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        // Subscribe to state changes for real-time updates
        const unsubscribe = feed.state.subscribe((state) => {
          console.log("Notification feed state updated:", state);
          console.log("notification_status details:", state.notification_status);
          
          // Update unread count - try both 'unseen' and 'unread'
          const unseenCount = state.notification_status?.unseen || 0;
          const unreadCountFromStatus = state.notification_status?.unread || 0;
          const newUnreadCount = unseenCount || unreadCountFromStatus;
          
          console.log("unseenCount:", unseenCount, "unreadCount:", unreadCountFromStatus, "using:", newUnreadCount);
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

        // Clean up any existing event listener before creating a new one
        if (eventListenerRef.current) {
          feed.off('feeds.notification_feed.updated', eventListenerRef.current);
        }

        // Listen for new notifications and refetch to get updated notification_status
        // This is needed because the state subscription doesn't update notification_status for real-time events
        const handleNotificationUpdate = async (event: any) => {
          console.log('🔔 Notification feed updated event:', event);
          
          // Prevent multiple simultaneous fetches and debounce (max once per second)
          const now = Date.now();
          if (isFetchingRef.current || (now - lastFetchTimeRef.current) < 1000) {
            console.log('🔔 Skipping refetch (too soon or already fetching)');
            return;
          }
          
          isFetchingRef.current = true;
          lastFetchTimeRef.current = now;
          
          try {
            // Refetch without watch to just get the latest data including notification_status
            const updatedData = await feed.getOrCreate({ watch: false });
            console.log('🔔 Refetched notification data:', updatedData.notification_status);
            
            const refetchedUnseen = updatedData.notification_status?.unseen || 0;
            const refetchedUnread = updatedData.notification_status?.unread || 0;
            const refetchedCount = refetchedUnseen || refetchedUnread;
            
            console.log('🔔 Refetched counts - unseen:', refetchedUnseen, 'unread:', refetchedUnread, 'using:', refetchedCount);
            
            setUnreadCount(refetchedCount);
            setNotificationsData(updatedData);
          } catch (err) {
            console.error('Error refetching notifications:', err);
          } finally {
            isFetchingRef.current = false;
          }
        };

        eventListenerRef.current = handleNotificationUpdate;
        feed.on('feeds.notification_feed.updated', handleNotificationUpdate);

      } catch (error) {
        console.error("Error setting up notifications:", error);
        showError("Error setting up notifications");
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
      if (eventListenerRef.current && notificationsFeedRef.current) {
        notificationsFeedRef.current.off('feeds.notification_feed.updated', eventListenerRef.current);
        eventListenerRef.current = null;
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
      showError("Error marking notifications as seen");
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