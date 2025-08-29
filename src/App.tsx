import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import RightSidebar from './components/RightSidebar'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Chat from './components/Chat'
import './App.css'
import Feeds from './components/Feeds'
import BookmarkedPosts from './pages/BookmarkedPosts'
import UserProfile from './pages/UserProfile'
import Login from './pages/Login'

function App() {
  const { isLoading, error, isAuthenticated } = useAuth0()
  const location = useLocation()

  // Determine if we should show the sidebars (feeds, bookmarked, and profile pages)
  const showSidebars = isAuthenticated && (location.pathname === '/feeds' || location.pathname === '/bookmarked' || location.pathname.startsWith('/profile/'))

  // No dynamic positioning needed - header is always visible and fixed

  if (error) {
    return <div>Authentication Error: {error.message}</div>
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="app">
      {isAuthenticated && <Header showNavigation={!showSidebars} />}
      {showSidebars && <Sidebar />}
      {showSidebars && <RightSidebar />}
      <main className={`app-main ${showSidebars ? 'with-sidebars' : ''}`}>
        <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/feeds" replace /> : <Login />
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/feeds" element={
            <ProtectedRoute>
              <Feeds />
            </ProtectedRoute>
          } />
          <Route path="/bookmarked" element={
            <ProtectedRoute>
              <BookmarkedPosts />
            </ProtectedRoute>
          } />
          <Route path="/profile/:userId" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App
