import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import LoadingIcon from '../components/LoadingIcon'

const Login: React.FC = () => {
  const { loginWithRedirect, isLoading } = useAuth0()

  const handleLogin = () => {
    loginWithRedirect()
  }

  return (
    <div className="login">
      <div className="login-content">
        <div className="login-brand">
          <div className="login-logo">
            <span>S</span>
          </div>
          <h1 className="login-title">
            Welcome to StreamApp
          </h1>
          <p className="login-subtitle">
            Sign in to access your feeds and start chatting
          </p>
        </div>
        {isLoading ? (
          <div className="login-cta login-cta-loading">
            <LoadingIcon size={24} />
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="login-cta auth0-signin-button"
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
    </div>
  )
}

export default Login
