import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Navigate } from 'react-router-dom'

const Login: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0()

  const handleLogin = () => {
    loginWithRedirect()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    isAuthenticated ? (
      <Navigate to="/dashboard" replace />
    ) : ( 
        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="space-y-6">
              <div className="text-center">
                <button
                  onClick={handleLogin}
                >
                  Sign In with Auth0
                </button>
              </div>
            </div>
          </div>
        </div>
    )
  )
}

export default Login
