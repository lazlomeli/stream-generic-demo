import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth0()

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      {!isAuthenticated ? (
        <div className="text-center max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-3xl font-bold">S</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to StreamApp
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Build engaging experiences with real-time features and modern design.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </div>
      ) : (
        <div className="text-center max-w-3xl mx-auto px-4">
          <div className="mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <span className="text-white text-4xl font-bold">🚀</span>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Coming soon!
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              We're working hard to bring you something amazing. Stay tuned for updates and new features.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Building in progress</span>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
