import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Header from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Chat from './components/Chat'
import './App.css'
import Feeds from './components/Feeds'

function App() {
  const { isLoading, error } = useAuth0()

  if (error) {
    return <div>Authentication Error: {error.message}</div>
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
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
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
