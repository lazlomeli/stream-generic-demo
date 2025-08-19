import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth0()

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
          <Link
            to="/login"
            className="home-cta"
          >
            Get Started
          </Link>
        </div>
      ) : (
        <div className="home-content home-content-authenticated text-center max-w-3xl mx-auto px-4">
          <div className="home-brand mb-8">
            <div className="home-logo home-logo-authenticated">
              <span>🚀</span>
            </div>
            <h1 className="home-title home-title-authenticated mb-6">
              Welcome to StreamApp!
            </h1>
            <p className="home-subtitle home-subtitle-authenticated">
              Your real-time chat application is ready. Click the chat button in the header to start messaging!
            </p>
            <div className="home-status space-x-4">
              <div className="status-dot status-dot-blue"></div>
              <span>Ready to chat</span>
              <div className="status-dot status-dot-purple"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
