import React from 'react'
import LoadingIcon from './LoadingIcon'

const LoadingSpinner: React.FC = () => {
  return (
    <div 
      className="loading-spinner-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 1000
      }}
    >
      <LoadingIcon size={80} />
    </div>
  )
}

export default LoadingSpinner
