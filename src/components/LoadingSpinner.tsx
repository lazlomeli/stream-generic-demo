import React from 'react'
import { createPortal } from 'react-dom'
import LoadingIcon from './LoadingIcon'

interface LoadingSpinnerProps {
  darkMode?: boolean
  mobile?: boolean
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ darkMode = false, mobile = false }) => {
  if (mobile) {
    // Mobile version that works inside iPhone frame
    return (
      <div 
        className="mobile-loading-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          zIndex: 1000,
          borderRadius: '40px', // Match iPhone content border radius
          gap: '1rem'
        }}
      >
        <LoadingIcon size={60} />
        <div style={{
          color: darkMode ? '#ffffff' : '#000000',
          fontSize: '1rem',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          Loading...
        </div>
      </div>
    )
  }

  // Desktop version (original behavior)
  const overlay = (
    <div 
      className="loading-spinner-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        zIndex: 99999 /* Much higher z-index to ensure it covers everything including sidebars */
      }}
    >
      <LoadingIcon size={80} />
    </div>
  )

  // Use portal to render at document body level, ensuring it covers everything
  return createPortal(overlay, document.body)
}

export default LoadingSpinner
