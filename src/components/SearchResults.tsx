import React from 'react';
import './SearchResults.css';
import { ActivityResponse, UserResponse } from '@stream-io/feeds-client';
import Activity from './Activity';
import { useNavigate } from 'react-router-dom';
import { generateAvatarUrl } from '../utils/avatarUtils';
import { UserActions } from './UserActions';

interface SearchResultsProps {
  activities?: ActivityResponse[];
  users?: UserResponse[];
  searchQuery: string;
  isLoading: boolean;
  error?: boolean;
  onClose?: () => void;
}

export function SearchResults({
  activities = [],
  users = [],
  searchQuery,
  isLoading,
  error,
  onClose,
}: SearchResultsProps) {
  const navigate = useNavigate();
  const hasResults = activities.length > 0 || users.length > 0;

  const handleGoToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
    onClose?.(); // Close the search dropdown
  };

  const handlePostClick = (activityId: string, event: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on interactive elements
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, textarea, select');
    
    if (!isInteractive) {
      navigate(`/feeds/for-you?postId=${activityId}`);
      onClose?.(); // Close the search dropdown
    }
  };

  if (isLoading) {
    return (
      <div className="search-results-container">
        <div className="search-state-container">
          <div className="search-loading-spinner" />
          <p className="search-state-text">
            Searching for "{searchQuery}"...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results-container">
        <div className="search-state-container">
          <div className="search-state-icon error">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="search-state-text error">Error searching</p>
        </div>
      </div>
    );
  }

  if (!searchQuery.trim()) {
    return (
      <div className="search-results-container">
        <div className="search-state-container large">
          <div className="search-state-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="search-state-title">Search for activities</h3>
          <p className="search-state-subtitle">
            Enter a search term to find activities
          </p>
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="search-results-container">
        <div className="search-state-container large">
          <div className="search-state-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="search-state-title">No results found</h3>
          <p className="search-state-subtitle">
            No activities found for "{searchQuery}"
          </p>
          <p className="search-state-hint">
            Try different keywords or search terms
          </p>
        </div>
      </div>
    );
  }

  const totalResults = activities.length + users.length;

  return (
    <>
      {/* Results Header - Sticky */}
      <div className="search-results-header">
        <div className="search-results-info">
          <svg className="search-results-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="search-results-count">
            {totalResults} result{totalResults !== 1 ? "s" : ""} for
            "{searchQuery}"
          </span>
        </div>
        <div className="search-results-badges">
          {users.length > 0 && (
            <span className="badge badge-users">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          )}
          {activities.length > 0 && (
            <span className="badge badge-activities">
              {activities.length} {activities.length === 1 ? "activity" : "activities"}
            </span>
          )}
        </div>
      </div>

      {/* Users Results */}
      {users.length > 0 && (
        <div className="search-results-section">
          <h4 className="search-section-title">Users</h4>
          <div className="search-users-list">
            {users.map((user) => (
              <div key={user.id} className="search-user-item" onClick={() => handleGoToProfile(user.id)}>
                <div className="search-user-avatar">
                  <img 
                    src={generateAvatarUrl(user.id)} 
                    alt={user.name}
                    className="avatar-image"
                  />
                </div>
                <div className="search-user-info">
                  <div className="search-user-name">{user.name}</div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <UserActions targetUserId={user.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities Results */}
      {activities.length > 0 && (
        <div className="search-results-section">
          <h4 className="search-section-title">Activities</h4>
          <div className="search-results-list">
            {activities.map((activity) => (
              <div
                key={`search-activity-${activity.id}`}
                onClick={(e) => handlePostClick(activity.id, e)}
                className="search-activity-wrapper"
              >
                <Activity
                  activity={activity}
                  compactMode={true}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
