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

  // Scroll-based sidebar padding adjustment
  React.useEffect(() => {
    if (!showSidebars) return

    const handleScroll = () => {
      const headerHeight = 64 // 4rem in pixels
      const scrollY = window.scrollY
      
      // Check if we're on mobile (simplified check)
      const isMobile = window.innerWidth <= 768
      const basePadding = isMobile ? 80 : 96 // 5rem for mobile, 6rem for desktop
      const minPadding = 16 // 1rem minimum
      
      // Calculate dynamic padding: reduce padding as we scroll past header
      let dynamicPadding
      if (scrollY <= headerHeight) {
        // Still showing header, keep original padding
        dynamicPadding = basePadding
      } else {
        // Scrolled past header, smoothly reduce padding
        const scrollPastHeader = scrollY - headerHeight
        dynamicPadding = Math.max(minPadding, basePadding - scrollPastHeader)
      }
      
      // Set CSS custom property for sidebar padding
      document.documentElement.style.setProperty('--sidebar-top-padding', `${dynamicPadding}px`)
    }

    // Set initial padding
    handleScroll()
    
    // Add scroll and resize listeners
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      document.documentElement.style.removeProperty('--sidebar-top-padding')
    }
  }, [showSidebars])

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
