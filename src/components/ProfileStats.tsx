import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfileStats } from "../hooks/feeds/useProfileStats";
import { FollowUser } from "../hooks/feeds/useProfileStats";
import { useUser } from "../hooks/feeds/useUser";
import { X, UserPlus, UserMinus } from "lucide-react";
import { User } from "@auth0/auth0-react";
import "./ProfileStats.css";

interface ProfileStatsProps {
  user: User;
  isOwnProfile?: boolean;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: FollowUser[];
  isLoading: boolean;
  onFollow?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
  isFollowing?: (userId: string) => boolean;
  isFollowLoading?: boolean;
  isUnfollowLoading?: boolean;
  isOwnProfile?: boolean;
}

export function ProfileStats({ user, isOwnProfile = false }: ProfileStatsProps) {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"followers" | "following">("followers");
  const { user: currentUser } = useUser();

  const profileStats = useProfileStats(user.id);
  const {
    followers,
    following,
    isLoading,
    followUser,
    unfollowUser,
    isFollowing,
    isFollowingLoading,
    isUnfollowingLoading,
  } = profileStats;

  const filteredFollowers = isOwnProfile 
    ? followers.filter(follower => follower.id !== user.id)
    : followers;
  
  const filteredFollowing = isOwnProfile 
    ? following.filter(followingUser => followingUser.id !== user.id)
    : following;

  const handleOpenModal = (tab: "followers" | "following") => {
    setActiveTab(tab);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const getCurrentUsers = () => {
    return activeTab === "followers" ? filteredFollowers : filteredFollowing;
  };

  const getCurrentTitle = () => {
    return activeTab === "followers" ? "Followers" : "Following";
  };

  return (
    <>
      <div className="profile-stats-container">
        <button
          onClick={() => handleOpenModal("followers")}
          className="stat-button"
        >
          <div className="stat-number">{filteredFollowers.length}</div>
          <div className="stat-label">Followers</div>
        </button>

        <button
          onClick={() => handleOpenModal("following")}
          className="stat-button"
        >
          <div className="stat-number">{filteredFollowing.length}</div>
          <div className="stat-label">Following</div>
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-tabs-header">
              <div className="modal-tabs">
                <button
                  onClick={() => setActiveTab("followers")}
                  className={`tab-button ${
                    activeTab === "followers"
                      ? "active"
                      : ""
                  }`}
                >
                  Followers ({filteredFollowers.length})
                </button>
                <button
                  onClick={() => setActiveTab("following")}
                  className={`tab-button ${
                    activeTab === "following"
                      ? "active"
                      : ""
                  }`}
                >
                  Following ({filteredFollowing.length})
                </button>
              </div>
              <button
                onClick={handleCloseModal}
                className="modal-close-button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-content">
              {isLoading ? (
                <div className="modal-loading">
                  <div className="loading-spinner" />
                  <p className="loading-text">Loading...</p>
                </div>
              ) : getCurrentUsers().length === 0 ? (
                <div className="modal-empty">
                  <p className="empty-text">No {getCurrentTitle().toLowerCase()} found</p>
                </div>
              ) : (
                <div className="user-list">
                  {getCurrentUsers().map((user) => (
                    <div
                      key={user.id}
                      className="user-item"
                    >
                      <Link
                        to={`/profile/${user.id}`}
                        className="user-info-link"
                      >
                        <div className="user-avatar">
                          <span className="user-avatar-text">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="user-details">
                          <p className="user-name">{user.name}</p>
                          <p className="user-handle">@{user.id}</p>
                        </div>
                      </Link>
                      {user.id !== currentUser?.nickname && (
                        <button
                          onClick={() => {
                            if (isFollowing(user.id)) {
                              unfollowUser(user.id);
                            } else {
                              followUser(user.id);
                            }
                          }}
                          disabled={isFollowingLoading || isUnfollowingLoading}
                          className={`follow-button ${
                            isFollowing(user.id)
                              ? "following"
                              : ""
                          }`}
                        >
                          {isFollowing(user.id) ? (
                            <UserMinus className="h-4 w-4" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 