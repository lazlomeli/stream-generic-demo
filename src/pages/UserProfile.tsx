import { useUser } from "../hooks/feeds/useUser";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { ProfileStats } from "../components/ProfileStats";
import { UserPlus, UserMinus, ArrowLeft } from "lucide-react";
// import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FeedsClient } from "@stream-io/feeds-client";
import { useParams } from "react-router-dom";

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
//   const router = useRouter();
  const [realUserName, setRealUserName] = useState('');
  
  // Handle case where userId might be undefined
  if (!userId) {
    return <div className="bg-zinc-900 rounded-lg p-6 text-white">User not found</div>;
  }
  
  const {
    isFollowing,
    followUser,
    unfollowUser,
    isFollowingLoading,
    isUnfollowingLoading,
  } = useProfileStats(userId);

  const isOwnProfile = currentUser?.id === userId;
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
    <div className="bg-zinc-900 rounded-lg p-6">
      {/* Header */}

      {/* Profile Info */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-2xl font-bold">
            {displayUserName.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">{displayUserName}</h2>
          <p className="text-gray-400 text-sm">@{userId}</p>
        </div>

        {/* Follow/Unfollow Button - Only show if not own profile */}
        {!isOwnProfile && currentUser && (
          <button
            onClick={() => {
              console.log('click follow')
              handleFollowToggle();
            }}
            disabled={isFollowingLoading || isUnfollowingLoading}
            className={`px-4 py-2 rounded-full font-medium transition-colors flex items-center space-x-2 ${
              isFollowingUser
                ? "bg-gray-600 text-white hover:bg-red-600"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isFollowingLoading || isUnfollowingLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isFollowingUser ? (
              <>
                <UserMinus className="h-4 w-4" />
                <span>Unfollow</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Follow</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6">
        <ProfileStats user={{ id: userId, name: displayUserName }} isOwnProfile={isOwnProfile} />
      </div>

      {/* Bio Section */}
      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-white mb-3">About</h3>
        <p className="text-gray-400">
          This is a demo profile. User information and bio would be stored in your database.
        </p>
      </div>
    </div>
  );
} 