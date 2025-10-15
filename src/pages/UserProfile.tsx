import { useUser } from "../hooks/feeds/useUser";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { ProfileStats } from "../components/ProfileStats";
import { UserPlus, UserMinus, ArrowLeft } from "lucide-react";
// import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FeedsClient } from "@stream-io/feeds-client";
import { useNavigate } from "react-router-dom";
import { useUserActions } from "../hooks/feeds/useUserActions";

interface UserProfileProps {
  userId: string;
  userName: string;
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

// export function UserProfile({ userId, userName, onBack }: UserProfileProps) {
export function UserProfile() {
  const { user: currentUser, client } = useUser();
  const [realUserName, setRealUserName] = useState(currentUser?.name);
  const navigate = useNavigate();
  const { isOwnUser } = useUserActions(currentUser?.nickname!);

  const {
    isFollowing,
    followUser,
    unfollowUser,
    isFollowingLoading,
    isUnfollowingLoading,
  } = useProfileStats(currentUser?.nickname);

  const isFollowingUser = isFollowing(currentUser?.nickname!);

  useEffect(() => {
    const fetchRealUserName = async () => {
      if (client && currentUser?.nickname) {
        const realName = await getUserNameFromActivities(client, currentUser?.nickname!);
        setRealUserName(realName);
      }
    };
    fetchRealUserName();
  }, [client, currentUser?.nickname]);

  const handleFollowToggle = () => {
    if (isFollowingUser) {
      unfollowUser(currentUser?.nickname!);
    } else {
      followUser(currentUser?.nickname!);
    }
  };


  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{realUserName}</h1>
          <p className="text-gray-400 text-sm">@{currentUser?.nickname}</p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-2xl font-bold">
            {currentUser?.name?.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">{realUserName}</h2>
          <p className="text-gray-400 text-sm">@{currentUser?.nickname}</p>
        </div>

        {/* Follow/Unfollow Button - Only show if not own profile */}
        {!isOwnUser && currentUser && (
          <button
            onClick={handleFollowToggle}
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
        <ProfileStats user={{ id: currentUser?.nickname!, name: realUserName }} isOwnProfile={isOwnUser} />
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