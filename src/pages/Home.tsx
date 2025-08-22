import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import StreamLogo from '../assets/stream-logo.png'

const Home: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0()

  const handleLogin = () => {
    loginWithRedirect()
  }

  return (
    <div className="home">
      {!isAuthenticated ? (
        <div className="home-content text-center max-w-2xl mx-auto px-4">
          <div className="home-brand mb-8">
            <div className="home-logo">
              <span>S</span>
            </div>
            <h1 className="home-title mb-4">
              Welcome to StreamApp
            </h1>
            <p className="home-subtitle">
              Build engaging experiences with real-time features and modern design.
            </p>
          </div>
          {isLoading ? (
            <div className="home-cta home-cta-loading">
              <span>Loading...</span>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="home-cta auth0-signin-button"
            >
              <svg 
                className="auth0-icon" 
                viewBox="0 0 24 24" 
                width="20" 
                height="20"
              >
                <path 
                  fill="currentColor" 
                  d="M17.5 11c.3 0 .5.2.5.5v4c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-4c0-.3.2-.5.5-.5zm-5.5 0c.3 0 .5.2.5.5v4c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-4c0-.3.2-.5.5-.5zm-5.5 0c.3 0 .5.2.5.5v4c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-4c0-.3.2-.5.5-.5zm11-6.5c1.4 0 2.5 1.1 2.5 2.5v10c0 1.4-1.1 2.5-2.5 2.5h-11c-1.4 0-2.5-1.1-2.5-2.5v-10c0-1.4 1.1-2.5 2.5-2.5h11zm0 1h-11c-.8 0-1.5.7-1.5 1.5v10c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5v-10c0-.8-.7-1.5-1.5-1.5z"
                />
              </svg>
              Sign in with Auth0
            </button>
          )}
        </div>
      ) : (
        <div className="home-content home-content-authenticated text-center max-w-3xl mx-auto px-4">
          <div className="home-brand mb-8">
            <img src={StreamLogo} alt="Stream Logo" />
            <h1 className="home-title home-title-authenticated mb-6">
              Welcome to Stream All-in-One Demo
            </h1>
            <p className="home-subtitle home-subtitle-authenticated">
              Showcase of Stream Chat, Activity Feeds & Video.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
