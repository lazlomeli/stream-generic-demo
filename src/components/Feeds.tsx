import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../hooks/feeds/useUser';
import { useFeedManager } from '../hooks/feeds/useFeedManager';
import { useFeedActions } from '../hooks/feeds/useFeedActions';
import { Composer } from './Composer';
import Activity from './Activity';
import { useEffect, useRef } from 'react';
import { useSearch } from '../hooks/feeds/useSearch';
import { useSearchParams } from 'react-router-dom';

const Feeds = () => {
  // const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { user, client, loading, error, showUserModal, retryConnection } = useUser();
  // const { activities, feedType, loading: loadingFeeds, switchFeedType } = useFeedManager();
  const { activities: globalActivities, clearSearch, isLoading } = useSearch();
  const {
    posting,
    deleting,
    refetching, 
    handlePost, 
    handleDeleteActivity, 
    handleRefetchFeeds, 
    createPostMutation, 
    deletePostMutation, 
    refetchFeedsMutation 
  } = useFeedActions();

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedPostId = searchParams.get('postId');
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Scroll to and highlight the post when postId is in URL
  useEffect(() => {
    if (highlightedPostId && postRefs.current[highlightedPostId]) {
      const postElement = postRefs.current[highlightedPostId];
      
      // Smooth scroll to the post
      setTimeout(() => {
        postElement?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Add temporary highlight animation
        postElement?.classList.add('post-highlighted');
        
        // Remove highlight after animation
        setTimeout(() => {
          postElement?.classList.remove('post-highlighted');
          // Clear the postId from URL
          setSearchParams({});
        }, 2000);
      }, 300);
    }
  }, [highlightedPostId, globalActivities, setSearchParams]);

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <Composer />
      <div>
        {globalActivities.map((activity) => (
          <div 
            key={`feed-${activity.id}`}
            ref={(el) => { postRefs.current[activity.id] = el; }}
          >
            <Activity activity={activity} />
          </div>
        ))}
      </div>
    </div>
  )
};

export default Feeds;
