import { useUser } from "../hooks/feeds/useUser";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { ProfileStats } from "../components/ProfileStats";
import { UserPlus, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { FeedsClient, ActivityResponse } from "@stream-io/feeds-client";
import { useParams, useLocation } from "react-router-dom";
import { useResponsive } from "../contexts/ResponsiveContext";
import Activity from "../components/Activity";
import MobileBottomNav from "../components/MobileBottomNav";
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
  const [userPosts, setUserPosts] = useState<ActivityResponse[]>([]);
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

  // Get real user name from activities and fetch user posts
  useEffect(() => {
    const fetchUserData = async () => {
      if (client && userId) {
        try {
          setLoadingPosts(true);
          const response = await client.queryActivities({
            filter: {
              user_id: userId,
            },
            limit: 50,
            sort: [{ field: "created_at", direction: -1 }],
          });

          if (response.activities && response.activities.length > 0) {
            const realName = response.activities[0].user?.name || `User ${userId.replace("user-", "")}`;
            setRealUserName(realName);
            setUserPosts(response.activities.filter(activity => activity.type === "post"));
          } else {
            setRealUserName(`User ${userId.replace("user-", "")}`);
            setUserPosts([]);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setRealUserName(`User ${userId.replace("user-", "")}`);
          setUserPosts([]);
        } finally {
          setLoadingPosts(false);
        }
      }
    };
    fetchUserData();
  }, [client, userId]);
  
  // Set default user name while loading
  const displayUserName = realUserName || `User ${userId.replace("user-", "")}`;

  const handleFollowToggle = () => {
    if (isFollowingUser) {
      console.log('111')
      unfollowUser(userId);
    } else {
      console.log('222')
      followUser(userId);
    }
  };

  const profileContent = (
    <div className="user-profile-container">
      {/* Profile Info */}
      <div className="profile-info">
        <div className="profile-avatar">
          <span className="profile-avatar-text">
            {displayUserName.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div className="profile-details">
          <h2 className="profile-name">{displayUserName}</h2>
          <p className="profile-username">@{userId}</p>
        </div>

        {/* Follow/Unfollow Button - Only show if not own profile */}
        {!isOwnProfile && currentUser && (
          <button
            onClick={() => {
              console.log('click follow')
              handleFollowToggle();
            }}
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
            {userPosts.map((post) => (
              <Activity key={`profile-post-${post.id}`} activity={post} hideFollowButton={true} />
            ))}
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