import React, { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import SendIcon from '../icons/send.svg'
import Chat from './Chat'

const Header: React.FC = () => {
  const { isAuthenticated, user } = useAuth0()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const handleChatClick = () => {
    setIsChatOpen(true)
  }

  const handleCloseChat = () => {
    setIsChatOpen(false)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left side - Logo and future icons */}
            <div className="flex items-center space-x-8">
              {/* Space for future icons */}
              <div className="flex items-center space-x-6">
                {isAuthenticated && (
                  <button
                    onClick={handleChatClick}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                    title="Stream Chat"
                  >
                    <img src={SendIcon} alt="Send" className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-4">
              {isAuthenticated && (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-700 font-medium">
                    {user?.name || user?.email}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stream Chat Modal */}
      <Chat isOpen={isChatOpen} onClose={handleCloseChat} />
    </>
  )
}

export default Header
