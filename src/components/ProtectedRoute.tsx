import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, useLocation } from 'react-router-dom'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowViewers?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowViewers = false }) => {
  const { isAuthenticated, isLoading } = useAuth0()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (allowViewers && location.pathname === '/video' && location.search.includes('live=')) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`
    localStorage.setItem('returnUrl', returnUrl)
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
