import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import StreamLogo from '../assets/stream-logo.png'
import LoadingIcon from '../components/LoadingIcon'

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
              <LoadingIcon size={24} />
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
        <div className="home-content home-content-authenticated text-center max-w-6xl mx-auto px-4">
          <div className="home-brand mb-8">
            <img src={StreamLogo} alt="Stream Logo" className="mx-auto mb-4 h-12" />
            <h1 className="home-title home-title-authenticated mb-4">
              Welcome to Stream All-in-One Demo
            </h1>
            <p className="home-subtitle home-subtitle-authenticated mb-6">
              Explore Stream's powerful real-time communication products
            </p>
          </div>

          {/* Stream Products Showcase */}
          <div className="stream-products-grid">
            <div className="product-card">
              <div className="product-icon product-icon-chat">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="product-title">Stream Chat</h3>
              <p className="product-description">
                Build scalable in-app messaging with real-time chat, threads, reactions, and moderation tools.
              </p>
              <div className="product-links">
                <a 
                  href="https://getstream.io/chat/docs/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="product-doc-link-small"
                >
                  Docs <span className="arrow">›</span>
                </a>
              </div>
            </div>

            <div className="product-card">
              <div className="product-icon product-icon-feeds">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M3 13H11V21H3M13 3H21V11H13M3 3H11V11H3M15 13H23V15H15M15 17H21V19H15" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="product-title">Activity Feeds</h3>
              <p className="product-description">
                Create engaging social experiences with activity feeds, notifications, and personalized timelines.
              </p>
              <div className="product-links">
                <a 
                  href="https://getstream.io/activity-feeds/docs/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="product-doc-link-small"
                >
                  Docs <span className="arrow">›</span>
                </a>
              </div>
            </div>

            <div className="product-card">
              <div className="product-icon product-icon-video">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="product-title">Video & Audio</h3>
              <p className="product-description">
                Add video calling, livestreaming, and audio rooms with ultra-low latency and global infrastructure.
              </p>
              <div className="product-links">
                <a 
                  href="https://getstream.io/video/docs/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="product-doc-link-small"
                >
                  Docs <span className="arrow">›</span>
                </a>
              </div>
            </div>
          </div>


        </div>
      )}
    </div>
  )
}

export default Home
