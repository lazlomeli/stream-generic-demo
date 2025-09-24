import React, { useState } from 'react'
import usersGroupIcon from '../icons/users-group.svg'
import sendIcon from '../icons/send.svg'

interface FallbackAvatarProps {
  src?: string
  alt: string
  className?: string
  size?: number
  channelType?: 'group' | 'dm'
  channelName?: string
}

const FallbackAvatar: React.FC<FallbackAvatarProps> = ({ 
  src, 
  alt, 
  className = '', 
  size = 24,
  channelType,
  channelName
}) => {
  const [imageError, setImageError] = useState(false)

  // If no src or image failed to load, show fallback
  if (!src || imageError) {
    // For group channels (more than 2 people), show users-group icon
    if (channelType === 'group') {
      return (
        <div 
          className={`fallback-avatar group-channel-avatar ${className}`}
          style={{ 
            width: `${size}px`, 
            height: `${size}px`,
            background: 'linear-gradient(135deg, #00a2ff 0%, #0031b6 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0
          }}
          title={alt}
        >
          <img 
            src={usersGroupIcon}
            alt="Group channel"
            style={{
              width: Math.max(size * 0.6, 12),
              height: Math.max(size * 0.6, 12),
              filter: 'brightness(0) invert(1)' // Makes the icon white
            }}
          />
        </div>
      )
    }
    
    // For DM channels, show send icon
    if (channelType === 'dm') {
      return (
        <div 
          className={`fallback-avatar dm-channel-avatar ${className}`}
          style={{ 
            width: `${size}px`, 
            height: `${size}px`,
            background: 'linear-gradient(135deg, #00a2ff 0%, #0031b6 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0
          }}
          title={alt}
        >
          <img 
            src={sendIcon}
            alt="Direct message"
            style={{
              width: Math.max(size * 0.5, 10),
              height: Math.max(size * 0.5, 10),
              filter: 'brightness(0) invert(1)' // Makes the icon white
            }}
          />
        </div>
      )
    }
    
    // For unknown type, show # as fallback
    return (
      <div 
        className={`fallback-avatar ${className}`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          background: 'linear-gradient(135deg, #00a2ff 0%, #0031b6 100%)',
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
