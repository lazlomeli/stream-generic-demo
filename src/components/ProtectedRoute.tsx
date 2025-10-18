import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, useLocation } from 'react-router-dom'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowViewers?: boolean // Allow access to viewers without auth
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowViewers = false }) => {
  const { isAuthenticated, isLoading } = useAuth0()
  const location = useLocation()

  if (isLoading) {
    console.log('  -> Showing loading spinner')
    return <LoadingSpinner />
  }

  // Special handling for livestream viewer links: allow access without authentication
  if (allowViewers && location.pathname === '/video' && location.search.includes('live=')) {
    console.log('  -> Allowing access for unauthenticated viewer to livestream')
    return <>{children}</>
  }

  // For all other protected routes, require authentication
  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`
    localStorage.setItem('returnUrl', returnUrl)
    console.log('  -> Stored returnUrl:', returnUrl)
    return <Navigate to="/login" replace />
  }

  console.log('  -> Access granted (authenticated user)')
  return <>{children}</>
}

export default ProtectedRoute
