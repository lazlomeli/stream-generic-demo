import { useUser } from "../hooks/feeds/useUser";
import { ActivityResponse } from "@stream-io/feeds-client";
import { useState, useEffect } from "react";
import { useResponsive } from "../contexts/ResponsiveContext";
import heartIcon from "../icons/heart.svg";
import heartFilledIcon from "../icons/heart-filled.svg";
import pinIcon from "../icons/feed-pin.svg";
import pinFilledIcon from "../icons/feed-pin-filled.svg";
import commentIcon from "../icons/comment.svg";
import bookmarkIcon from "../icons/bookmark.svg";
import bookmarkFilledIcon from "../icons/bookmark-filled.svg";
import "./Reaction.css";

type Props = {
  activity: ActivityResponse;
  onCommentsClick: () => void;
  forceBookmarked?: boolean;
  isPinned?: boolean;
  onPinStateChange?: () => void;
};

export default function ReactionsPanel({ 
  activity, 
  onCommentsClick, 
  forceBookmarked = false,
  isPinned: isPinnedProp,
  onPinStateChange
}: Props) {
  const [loading, setLoading] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [isPinned, setIsPinned] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { user, client } = useUser();
  const { isMobileView } = useResponsive();

  useEffect(() => {
    if (!user) return;

    const counts: Record<string, number> = {};
    const userReacts = new Set<string>();

    if (activity.reaction_groups) {
      Object.entries(activity.reaction_groups).forEach(([type, group]) => {
        counts[type] = group.count || 0;
      });
    }

    if (activity.latest_reactions) {
      activity.latest_reactions.forEach((reaction) => {
        if (reaction.user.id === user.nickname) {
          userReacts.add(reaction.type);
        }
      });
    }

    const ownBookmarks = (activity as unknown as Record<string, unknown>).own_bookmarks;
    const isBookmarkedByUser = Array.isArray(ownBookmarks) && ownBookmarks.length > 0;

    setReactionCounts(counts);
    setUserReactions(userReacts);
    setIsBookmarked(forceBookmarked || isBookmarkedByUser);
    
    // Use the prop if provided, otherwise default to false
    if (isPinnedProp !== undefined) {
      setIsPinned(isPinnedProp);
    }
  }, [activity, user, forceBookmarked, isPinnedProp]);

  const ensureNotificationFeedExists = async (userId: string) => {
    if (!client) return;
    
    try {
      const notificationFeed = client.feed('notification', userId);
      await notificationFeed.getOrCreate({ watch: false });
    } catch (err) {
      console.warn('Could not create notification feed for user:', userId, err);
    }
  };

  const handleReaction = async (type: string) => {
    if (loading || !client) return;

    try {
      setLoading(true);
      if (userReactions.has(type)) {
        await client.deleteActivityReaction({
          activity_id: activity.id,
          type,
        });
        setUserReactions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(type);
          return newSet;
        });
        setReactionCounts((prev) => ({
          ...prev,
          [type]: Math.max(0, (prev[type] || 0) - 1),
        }));
      } else {
        const activityOwnerId = activity.user?.id;
        if (activityOwnerId) {
          await ensureNotificationFeedExists(activityOwnerId);
        }
        
        await client.addActivityReaction({
          activity_id: activity.id,
          type,
          create_notification_activity: true,
        });
        setUserReactions((prev) => new Set([...prev, type]));
        setReactionCounts((prev) => ({
          ...prev,
          [type]: (prev[type] || 0) + 1,
        }));
      }
    } catch (err) {
      console.error("Failed to handle reaction", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async () => {
    if (loading || !client || !user) return;

    try {
      setLoading(true);
      if (isPinned) {
        await client.unpinActivity({
          feed_group_id: "user",
          feed_id: user.nickname,
          activity_id: activity.id,
        });
        setIsPinned(false);
      } else {
        await client.pinActivity({
          feed_group_id: "user",
          feed_id: user.nickname,
          activity_id: activity.id,
        });
        setIsPinned(true);
      }
      
      // Notify parent component that pin state changed
      if (onPinStateChange) {
        onPinStateChange();
      }
    } catch (err) {
      console.error("Failed to handle pin", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (loading || !client) return;

    try {
      setLoading(true);
      if (isBookmarked) {
        const bookmarks = (activity as unknown as Record<string, unknown>).own_bookmarks || [];
        if (Array.isArray(bookmarks) && bookmarks.length > 0) {
          const firstBookmark = bookmarks[0] as Record<string, unknown>;
          await client.deleteBookmark({
            activity_id: activity.id,
            folder_id: (firstBookmark.folder as Record<string, unknown>)?.id as string,
          });
        }
        setIsBookmarked(false);
      } else {
        await client.addBookmark({
          activity_id: activity.id,
        });
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error("Failed to handle bookmark", err);
    } finally {
      setLoading(false);
    }
  };

  const getReactionStyles = (type: string) => {
    const hasReaction = userReactions.has(type);
    
    switch (type) {
      case "like":
        return `reaction-button like ${hasReaction ? "active" : ""}`;
      case "pin":
        return `reaction-button pin ${isPinned ? "active" : ""}`;
      case "bookmark":
        return `reaction-button bookmark ${isBookmarked ? "active" : ""}`;
      default:
        return "reaction-button";
    }
  };

  const reactionCount = (type: string) => {
    return reactionCounts[type] || 0;
  };

  // Only show pin button if viewing own profile
  const showPinButton = activity.user?.id === user?.nickname;

  return (
    <div className="reactions-container">
      <div className="reactions-buttons">
        <button
          disabled={loading}
          onClick={() => handleReaction("like")}
          className={getReactionStyles("like")}
          title={userReactions.has("like") ? "Unlike" : "Like"}
        >
          <img
            src={userReactions.has("like") ? heartFilledIcon : heartIcon}
            alt="Like"
            width="14"
            height="14"
            className={`reaction-icon ${isMobileView ? "mobile" : ""} ${
              userReactions.has("like") ? "filled" : ""
            }`}
          />
          <span className="reaction-count">{reactionCount("like")}</span>
        </button>

        <button 
          onClick={onCommentsClick}
          title="Comments" 
          className="reaction-button"
        >
          <img
            src={commentIcon}
            alt="Comments"
            width="14"
            height="14"
            className={`reaction-icon ${isMobileView ? "mobile" : ""}`}
          />
          <span className="reaction-count">{activity.comment_count}</span>
        </button>

        {showPinButton && (
          <button
            disabled={loading}
            onClick={handlePin}
            className={getReactionStyles("pin")}
            title={isPinned ? "Unpin" : "Pin"}
          >
            <img
              src={isPinned ? pinFilledIcon : pinIcon}
              alt="Pin"
              width="14"
              height="14"
              className={`reaction-icon ${isMobileView ? "mobile" : ""} ${isPinned ? "filled" : ""}`}
            />
          </button>
        )}

        <button
          disabled={loading}
          onClick={handleBookmark}
          className={getReactionStyles("bookmark")}
          title={isBookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <img
            src={isBookmarked ? bookmarkFilledIcon : bookmarkIcon}
            alt="Bookmark"
            width="14"
            height="14"
            className={`reaction-icon ${isMobileView ? "mobile" : ""} ${isBookmarked ? "filled" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}