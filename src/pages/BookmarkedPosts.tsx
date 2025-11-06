import { useBookmarks } from "../hooks/feeds/useBookmarks";
import { useUser } from "../hooks/feeds/useUser";
import { useNavigate, useLocation } from "react-router-dom";
import { useResponsive } from "../contexts/ResponsiveContext";
import Activity from "../components/Activity";
import MobileBottomNav from "../components/MobileBottomNav";
import "./BookmarkedPosts.css";

export default function BookmarksPage() {
  const {
    error: userError,
    loading: clientLoading,
  } = useUser();

  const {
    bookmarkedActivities,
    isLoading,
    error: bookmarksError,
  } = useBookmarks();

  const navigate = useNavigate();
  const location = useLocation();
  const { isMobileView, toggleView } = useResponsive();

  const loading = clientLoading || isLoading;
  const error = userError || bookmarksError;

  const handlePostClick = (activityId: string, event: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on interactive elements
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, textarea, select');
    
    if (!isInteractive) {
      navigate(`/feeds/for-you?postId=${activityId}`);
    }
  };

  if (loading) {
    return <div className="bookmarks-loading">Loading bookmarks...</div>;
  }

  if (error) {
    return <div className="bookmarks-error">Error loading bookmarks</div>;
  }

  const bookmarksContent = (
    <div className="feeds-container">
      <div className="bookmarks-header">
        <h1>Bookmarks</h1>
        <p>Saved posts you want to read later.</p>
      </div>

      {bookmarkedActivities.length === 0 ? (
        <div className="bookmarks-empty-state">
          <div className="empty-title">No bookmarks yet</div>
          <p className="empty-description">
            Start bookmarking posts to see them here!
          </p>
        </div>
      ) : (
        <div className="bookmarks-list">
          {bookmarkedActivities.map((activity) => (
            <div 
              key={`bookmark-${activity.id}`}
              onClick={(e) => handlePostClick(activity.id, e)}
              className="bookmarked-post-wrapper"
            >
              <Activity activity={activity} forceBookmarked={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isMobileView) {
    return (
      <div className="bookmarks-page-container mobile-view">
        <div className="bookmarks-page-content mobile-content">
          {bookmarksContent}
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
    <div className="bookmarks-page-container desktop-view">
      <div className="bookmarks-page-content desktop-content">
        {bookmarksContent}
      </div>
    </div>
  );
}
