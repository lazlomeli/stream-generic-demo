import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Chat from './components/Chat'

function App() {
  const { isLoading, error } = useAuth0()
  const [currentView, setCurrentView] = useState<'home' | 'chat'>('home')

  const openChat = () => {
    setCurrentView('chat')
  }

  const closeChat = () => {
    setCurrentView('home')
  }

  if (error) {
    return <div>Authentication Error: {error.message}</div>
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Navbar onChatClick={openChat} />
      <main className="relative">
        <Routes>
          <Route path="/" element={
            currentView === 'chat' ? (
              <Chat isOpen={true} onClose={closeChat} />
            ) : (
              <Home />
            )
          } />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <p>hey</p>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
