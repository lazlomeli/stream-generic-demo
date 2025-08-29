import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import LoadingIcon from '../components/LoadingIcon'
import StreamBg from '../assets/stream-bg.avif'
import Auth0Icon from '../icons/brand-auth0.svg'
import './Login.css'

const Login: React.FC = () => {
  const { loginWithRedirect, isLoading } = useAuth0()

  const handleLogin = () => {
    loginWithRedirect()
  }

  return (
    <div className="login">
      {/* Image Section - Top */}
      <div className="login-image-section">
        <img 
          src={StreamBg} 
          alt="Stream Background" 
          className="login-background-image"
        />
      </div>

      {/* Sign In Form Section - Bottom */}
      <div className="login-form-section">
        <div className="login-content">
          {isLoading ? (
            <div className="login-cta login-cta-loading">
              <LoadingIcon size={48} />
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="login-cta auth0-signin-button"
            >
              <img 
                src={Auth0Icon}
                alt="Auth0" 
                className="auth0-icon" 
                width="20" 
                height="20"
              />
              Sign in with Auth0
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
