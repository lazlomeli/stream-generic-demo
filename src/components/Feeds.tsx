import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from './LoadingSpinner';
import { getSanitizedUserId } from '../utils/userUtils';
import './Feeds.css';

const Feeds = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [feedsClient, setFeedsClient] = useState<any>(null);
  const [clientReady, setClientReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initFeedsClient = async () => {
      if (!user || !isAuthenticated) return;

      try {
        setError(null);
        
        // Get Auth0 access token for backend authentication
        const accessToken = await getAccessTokenSilently();
        
        // Use shared utility to get sanitized userId
        const sanitizedUserId = getSanitizedUserId(user);
        
        // Call your local server endpoint to get the feed token
        const response = await fetch('/api/stream/feed-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ userId: sanitizedUserId }), // Use sanitized userId
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get feed token: ${response.status} ${errorText}`);
        }

        const { token, apiKey } = await response.json();

        // For now, just store the token and API key
        // We'll implement the actual feeds client later
        setFeedsClient({ token, apiKey, userId: sanitizedUserId });
        setClientReady(true);
        
        console.log('✅ Feed token received successfully');
      } catch (err: any) {
        console.error('Error getting feed token:', err);
        setError(err.message || 'Failed to get feed token');
      }
    };

    initFeedsClient();
  }, [user, isAuthenticated, getAccessTokenSilently]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="feeds-loading">
        <LoadingSpinner />
        <p>Loading...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="feeds-error">
        <h2>Error Loading Feeds</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Show loading state while client initializes
  if (!clientReady || !feedsClient) {
    return (
      <div className="feeds-loading">
        <LoadingSpinner />
        <p>Initializing feeds...</p>
      </div>
    );
  }

  // Render feeds when client is ready
  return (
    <div className="feeds-container">
      <h1>Activity Feeds</h1>
      <div className="feed-content">
        <p>Feed token received successfully!</p>
        <p>API Key: {feedsClient.apiKey ? '✅ Set' : '❌ Not set'}</p>
        <p>Token: {feedsClient.token ? '✅ Received' : '❌ Not received'}</p>
        <p>User ID: {feedsClient.userId}</p>
        <p>Original Auth0 ID: {user?.sub}</p>
      </div>
    </div>
  );
};

export default Feeds;
