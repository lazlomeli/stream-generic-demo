import React from 'react'
import { createPortal } from 'react-dom'
import LoadingIcon from './LoadingIcon'

const LoadingSpinner: React.FC = () => {
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
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
