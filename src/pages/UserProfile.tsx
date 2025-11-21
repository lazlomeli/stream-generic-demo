import { useUser } from "../hooks/feeds/useUser";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { ProfileStats } from "../components/ProfileStats";
import { UserPlus, UserMinus, Pin, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityResponse, ActivityPinResponse } from "@stream-io/feeds-client";
import { useParams, useLocation } from "react-router-dom";
import { useResponsive } from "../contexts/ResponsiveContext";
import Activity from "../components/Activity";
import MobileBottomNav from "../components/MobileBottomNav";
import { generateBannerImage, generateUserBio, generateAvatarUrl } from "../utils/avatarUtils";
import "./UserProfile.css";

interface UserProfileProps {
  onBack?: () => void;
}

export function UserProfile({ onBack }: UserProfileProps) {
  const { user: currentUser, client } = useUser();
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const { isMobileView, toggleView } = useResponsive();
  
  const [realUserName, setRealUserName] = useState('');
  const [userImage, setUserImage] = useState<string | undefined>();
  const [userPosts, setUserPosts] = useState<ActivityResponse[]>([]);
  const [pinnedActivityIds, setPinnedActivityIds] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Handle case where userId might be undefined
  if (!userId) {
    return <div className="user-not-found">User not found</div>;
  }

  const {
    isFollowing,
    followUser,
    unfollowUser,
    isFollowingLoading,
    isUnfollowingLoading,
  } = useProfileStats(userId);
  
  const isOwnProfile = currentUser?.nickname === userId;
  const isFollowingUser = isFollowing(userId);

  // Get real user name and fetch user posts + pinned activities
  useEffect(() => {
    const fetchUserData = async () => {
      if (client && userId) {
        try {
          setLoadingPosts(true);
          
          // Fetch the user's feed to get pinned activities
          const userFeed = client.feed('user', userId);
          const feedResponse = await userFeed.getOrCreate();
          
          // Extract pinned activity IDs
          const pinnedIds = new Set(
            (feedResponse.pinned_activities || []).map(pin => pin.activity.id)
          );
          setPinnedActivityIds(pinnedIds);
          
          // Query all user posts
          const response = await client.queryActivities({
            filter: {
              user_id: userId,
            },
            limit: 50,
            sort: [{ field: "created_at", direction: -1 }],
          });

          if (response.activities && response.activities.length > 0) {
            console.log("response.activities", response.activities);
            const realName = response.activities[0].user?.name || `User ${userId.replace("user-", "")}`;
            const profileImage = (response.activities[0].user as any)?.data?.image || 
                                (response.activities[0].user as any)?.profile?.image || 
                                (response.activities[0].user as any)?.image;
            setRealUserName(realName);
            setUserImage(profileImage);
            setUserPosts(response.activities.filter(activity => activity.type === "post"));
          } else {
            setRealUserName(`User ${userId.replace("user-", "")}`);
            setUserImage(undefined);
            setUserPosts([]);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setRealUserName(`User ${userId.replace("user-", "")}`);
          setUserPosts([]);
          setPinnedActivityIds(new Set());
        } finally {
          setLoadingPosts(false);
        }
      }
    };

    fetchUserData();
  }, [client, userId]);

  const displayUserName = realUserName || `User ${userId.replace("user-", "")}`;
  
  const handleFollowToggle = () => {
    if (isFollowingUser) {
      unfollowUser(userId);
    } else {
      followUser(userId);
    }
  };

  // Callback to refresh pinned activities when pin state changes
  const handlePinStateChange = async () => {
    if (!client) return;
    try {
      const userFeed = client.feed('user', userId);
      const feedResponse = await userFeed.getOrCreate();
      const pinnedIds = new Set(
        (feedResponse.pinned_activities || []).map(pin => pin.activity.id)
      );
      setPinnedActivityIds(pinnedIds);
    } catch (error) {
      console.error("Error refreshing pinned activities:", error);
    }
  };

  // Separate pinned and unpinned posts for display
  const pinnedPosts = userPosts.filter(post => pinnedActivityIds.has(post.id));
  const unpinnedPosts = userPosts.filter(post => !pinnedActivityIds.has(post.id));

  const profileContent = (
    <div className="user-profile-container">
      {/* Profile Banner */}
      <div 
        className="profile-banner"
        style={{ backgroundImage: `url(${generateBannerImage(userId)})` }}
      />

      {/* Profile Info */}
      <div className="profile-info">
        <div className="profile-avatar">
          <img 
            src={userImage || generateAvatarUrl(userId)}
            alt={displayUserName}
            className="profile-avatar-image"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = generateAvatarUrl(userId);
            }}
          />
        </div>
        
        <div className="profile-details">
          <h2 className="profile-name">{displayUserName}</h2>
          <p className="profile-username">@{userId}</p>
        </div>

        {/* Follow/Unfollow Button - Only show if not own profile */}
        {!isOwnProfile && currentUser && (
          <button
            onClick={handleFollowToggle}
            disabled={isFollowingLoading || isUnfollowingLoading}
            className={`follow-toggle-button ${isFollowingUser ? "following" : ""}`}
          >
            {isFollowingLoading || isUnfollowingLoading ? (
              <div className="follow-loading-spinner" />
            ) : isFollowingUser ? (
              <>
                <UserMinus className="follow-icon" />
                <span>Unfollow</span>
              </>
            ) : (
              <>
                <UserPlus className="follow-icon" />
                <span>Follow</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Bio and Metadata */}
      <div className="profile-metadata">
        <p className="profile-bio">{generateUserBio(userId)}</p>
        <div className="profile-join-date">
          <Calendar className="calendar-icon" />
          <span style={{ fontSize: '11px !important' }}>Joined Nov 2025</span>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats-section">
        <ProfileStats user={{ id: userId, name: displayUserName }} isOwnProfile={isOwnProfile} />
      </div>

      {/* User Posts Section */}
      <div className="profile-posts-section">
        <h3 className="posts-title">Posts</h3>
        
        {loadingPosts ? (
          <div className="posts-loading">Loading posts...</div>
        ) : userPosts.length === 0 ? (
          <div className="posts-empty">
            <p>{isOwnProfile ? "You haven't posted anything yet" : "No posts yet"}</p>
          </div>
        ) : (
          <div className="posts-list">
            {/* Pinned Posts Section */}
            {pinnedPosts.length > 0 && (
              <div className="pinned-posts-section">
                <h4 className="pinned-posts-header">
                  <Pin className="pin-icon" />
                  Pinned Posts
                </h4>
                {pinnedPosts.map((post) => (
                  <Activity 
                    key={`pinned-post-${post.id}`} 
                    activity={post} 
                    hideFollowButton={true}
                    isPinned={true}
                    onPinStateChange={handlePinStateChange}
                  />
                ))}
              </div>
            )}

            {/* Regular Posts Section */}
            {unpinnedPosts.length > 0 && (
              <div className="regular-posts-section">
                {pinnedPosts.length > 0 && <h4 className="regular-posts-header">Other Posts</h4>}
                {unpinnedPosts.map((post) => (
                  <Activity 
                    key={`profile-post-${post.id}`} 
                    activity={post} 
                    hideFollowButton={true}
                    isPinned={false}
                    onPinStateChange={handlePinStateChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobileView) {
    return (
      <div className="profile-page-container mobile-view">
        <div className="profile-page-content mobile-content">
          {profileContent}
          <MobileBottomNav currentPath={location.pathname} />
        </div>
        <button 
          className="desktop-toggle-button"
          onClick={toggleView}
          title="Switch to Desktop View"
        >
          Desktop
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page-container desktop-view">
      <div className="profile-page-content desktop-content">
        {profileContent}
      </div>
    </div>
  );
}