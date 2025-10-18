import { useUser } from "../hooks/feeds/useUser";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { ProfileStats } from "../components/ProfileStats";
import { UserPlus, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { FeedsClient } from "@stream-io/feeds-client";
import { useParams } from "react-router-dom";
import "./UserProfile.css";

interface UserProfileProps {
  onBack?: () => void;
}

// TODO: This is a temporary solution to get the user name from activities.
// We need to find a better way to get the user name from activities.
// This makes a lot of requests to the API.
// Get user name from activities
const getUserNameFromActivities = async (
  client: FeedsClient,
  userId: string
): Promise<string> => {
  try {
    const response = await client.queryActivities({
      filter: {
        user_id: userId,
      },
      limit: 1,
    });

    if (response.activities && response.activities.length > 0) {
      return response.activities[0].user?.name || `User ${userId.replace("user-", "")}`;
    }
    return `User ${userId.replace("user-", "")}`;
  } catch (error) {
    console.error("Error fetching user name:", error);
    return `User ${userId.replace("user-", "")}`;
  }
};

export function UserProfile({ onBack }: UserProfileProps) {
  const { user: currentUser, client } = useUser();
  const { userId } = useParams<{ userId: string }>();
  const [realUserName, setRealUserName] = useState('');
  
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

  // Get real user name from activities
  useEffect(() => {
    const fetchRealUserName = async () => {
      if (client && userId) {
        const realName = await getUserNameFromActivities(client, userId);
        setRealUserName(realName);
      }
    };
    fetchRealUserName();
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
    //   router.back();
    }
  };

  return (
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

      {/* Bio Section */}
      <div className="profile-bio-section">
        <h3 className="bio-title">About</h3>
        <p className="bio-text">
          This is a demo profile. User information and bio would be stored in your database.
        </p>
      </div>
    </div>
  );
} 