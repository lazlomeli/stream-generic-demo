import React, { useState } from 'react'

interface FallbackAvatarProps {
  src?: string
  alt: string
  className?: string
  size?: number
}

const FallbackAvatar: React.FC<FallbackAvatarProps> = ({ 
  src, 
  alt, 
  className = '', 
  size = 24 
}) => {
  const [imageError, setImageError] = useState(false)

  // If no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div 
        className={`fallback-avatar ${className}`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: `${Math.max(size * 0.4, 10)}px`,
          fontWeight: '600',
          flexShrink: 0
        }}
        title={alt}
      >
        #
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0
      }}
      onError={() => setImageError(true)}
      title={alt}
    />
  )
}

export default FallbackAvatar
