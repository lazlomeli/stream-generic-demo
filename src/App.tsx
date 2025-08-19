import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Header from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Chat from './components/Chat'
import './App.css'

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
    <div className="app">
      <Header onChatClick={openChat} onHomeClick={closeChat} />
      <main className="app-main">
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
