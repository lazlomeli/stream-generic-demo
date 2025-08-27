import React from 'react';
import StreamLoading from '../icons/stream-loading.svg';
import './LoadingIcon.css';

interface LoadingIconProps {
  size?: number;
  className?: string;
}

const LoadingIcon: React.FC<LoadingIconProps> = ({ size = 32, className = '' }) => {
  return (
    <div className={`loading-icon ${className}`} style={{ width: size, height: size }}>
      <img 
        src={StreamLoading} 
        alt="Loading..." 
        width="100%" 
        height="100%"
        style={{ 
          width: '100%',
          height: '100%',
          filter: 'grayscale(1) brightness(0.6) opacity(0.2)'
        }}
      />
    </div>
  );
};

export default LoadingIcon;
