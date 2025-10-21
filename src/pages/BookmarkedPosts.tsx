import { useBookmarks } from "../hooks/feeds/useBookmarks";
import { useUser } from "../hooks/feeds/useUser";
import { useNavigate } from "react-router-dom";
import Activity from "../components/Activity";
import "./BookmarkedPosts.css";

export default function BookmarksPage() {
  const {
    error: userError,
    loading: clientLoading,
    retryConnection,
  } = useUser();

  const {
    bookmarkedActivities,
    isLoading,
    error: bookmarksError,
  } = useBookmarks();

  const navigate = useNavigate();

  const loading = clientLoading || isLoading;
  const error = userError || bookmarksError;

  const handlePostClick = (activityId: string, event: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on interactive elements
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, textarea, select');
    
    if (!isInteractive) {
      navigate(`/feeds?postId=${activityId}`);
    }
  };

  if (loading) {
    return <div className="bookmarks-loading">Loading bookmarks...</div>;
  }

  if (error) {
    return <div className="bookmarks-error">Error loading bookmarks</div>;
  }

  return (
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
              <Activity activity={activity} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
