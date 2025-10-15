import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../hooks/feeds/useUser';
import { useFeedManager } from '../hooks/feeds/useFeedManager';
import { useFeedActions } from '../hooks/feeds/useFeedActions';
import { Composer } from './Composer';
import Activity from './Activity';
import { useEffect } from 'react';
import { useSearch } from '../hooks/feeds/useSearch';

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

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <Composer />
      <div>
        {globalActivities.map((activity) => (
          <Activity key={`feed-${activity.id}`} activity={activity} />
        ))}
      </div>
    </div>
  )
};

export default Feeds;
