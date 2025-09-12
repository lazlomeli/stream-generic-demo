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
import ToastContainer from './components/ToastContainer'
import { ToastProvider } from './contexts/ToastContext'
import './App.css'
import Feeds from './components/Feeds'
import BookmarkedPosts from './pages/BookmarkedPosts'
import UserProfile from './pages/UserProfile'
import Login from './pages/Login'

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

function App() {
  const { isLoading, error, isAuthenticated } = useAuth0()
  const location = useLocation()
  const [hideHeader, setHideHeader] = useState(false)

  // Determine if we should show the sidebars (feeds, bookmarked, and profile pages)
  const showSidebars = isAuthenticated && (location.pathname === '/feeds' || location.pathname === '/bookmarked' || location.pathname.startsWith('/profile/'))
  
  // Video page should use full layout without sidebars, similar to chat
  const isVideoPage = location.pathname === '/video'

  if (error) {
    return <div>Authentication Error: {error.message}</div>
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <UILayoutContext.Provider value={{ hideHeader, setHideHeader }}>
      <ToastProvider>
        <div className={`app ${hideHeader ? 'fullscreen-mode' : ''}`}>
          {isAuthenticated && !hideHeader && <Header showNavigation={!showSidebars && !isVideoPage} />}
          {showSidebars && <Sidebar />}
          {showSidebars && <RightSidebar />}
          <main className={`app-main ${showSidebars ? 'with-sidebars' : ''} ${hideHeader ? 'fullscreen' : ''}`}>
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
          <ToastContainer />
        </div>
      </ToastProvider>
    </UILayoutContext.Provider>
  )
}

export default App
