import React, { createContext, useContext, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import RightSidebar from './components/RightSidebar'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Chat from './components/Chat'
import Video from './components/Video'
import CallPage from './components/CallPage'
import ToastContainer from './components/ToastContainer'
import { ToastProvider } from './contexts/ToastContext'
import { ResponsiveProvider, useResponsive } from './contexts/ResponsiveContext'
import './App.css'
import Feeds from './components/Feeds'
// import BookmarkedPosts from './pages/BookmarkedPosts'
// import UserProfile from './pages/UserProfile'
// import Notifications from './pages/Notifications'
import Login from './pages/Login'
import { QueryProvider } from './utils/queryProvider'

// Context for controlling UI layout
interface UILayoutContextType {
  hideHeader: boolean
  setHideHeader: (hide: boolean) => void
}

const UILayoutContext = createContext<UILayoutContextType | undefined>(undefined)

export const useUILayout = () => {
  const context = useContext(UILayoutContext)
  if (context === undefined) {
    throw new Error('useUILayout must be used within a UILayoutProvider')
  }
  return context
}

function AppContent() {
  const { isLoading, error, isAuthenticated } = useAuth0()
  const location = useLocation()
  const [hideHeader, setHideHeader] = useState(false)
  const { isMobileView } = useResponsive()

  // Determine if we should show the sidebars (feeds, bookmarked, notifications, and profile pages)
  const showSidebars = isAuthenticated && !isMobileView && (location.pathname === '/feeds' || location.pathname === '/bookmarked' || location.pathname === '/notifications' || location.pathname.startsWith('/profile/'))
  
  // Video and call pages should use full layout without sidebars, similar to chat
  const isVideoPage = location.pathname === '/video'
  const isCallPage = location.pathname.startsWith('/call/')
  
  // Hide header in mobile view for all pages
  const shouldHideHeader = hideHeader || isMobileView

  if (error) {
    return <div>Authentication Error: {error.message}</div>
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <QueryProvider>
      <UILayoutContext.Provider value={{ hideHeader, setHideHeader }}>
        <div className={`app ${shouldHideHeader ? 'fullscreen-mode' : ''} ${isMobileView ? 'mobile-app' : ''}`}>
          {isAuthenticated && !shouldHideHeader && <Header showNavigation={!showSidebars && !isVideoPage && !isCallPage} />}
          {showSidebars && <Sidebar />}
          {showSidebars && <RightSidebar />}
          <main className={`app-main ${showSidebars ? 'with-sidebars' : ''} ${shouldHideHeader ? 'fullscreen' : ''} ${isMobileView ? 'mobile-main' : ''}`}>
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
                <Route path="/chat/:channelId" element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                } />
                <Route path="/video" element={
                  <ProtectedRoute allowViewers={true}>
                    <Video />
                  </ProtectedRoute>
                } />
                <Route path="/call/:callId" element={
                  <ProtectedRoute>
                    <CallPage />
                  </ProtectedRoute>
                } />
                <Route path="/feeds" element={
                  <ProtectedRoute>
                    <Feeds />
                  </ProtectedRoute>
                } />
                <Route path="/bookmarked" element={
                  <ProtectedRoute>
                    {/* <BookmarkedPosts /> */}
                    <></>
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute>
                    {/* <Notifications /> */}
                    <></>
                  </ProtectedRoute>
                } />
                <Route path="/profile/:userId" element={
                  <ProtectedRoute>
                    {/* <UserProfile /> */}
                    <></>
                  </ProtectedRoute>
                } />
              </Routes>
            </main>
            <ToastContainer />
          </div>
      </UILayoutContext.Provider>
    </QueryProvider>
  )
}

function App() {
  return (
    <ResponsiveProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ResponsiveProvider>
  )
}

export default App
