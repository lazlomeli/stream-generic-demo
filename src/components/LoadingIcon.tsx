import React from 'react';
import StreamLoading from '../icons/stream-loading.svg';
import './LoadingIcon.css';

interface LoadingIconProps {
  size?: number;
  className?: string;
}

const LoadingIcon: React.FC<LoadingIconProps> = ({ size = 48, className = '' }) => {
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
          filter: 'brightness(0) saturate(100%) invert(46%) sepia(8%) saturate(629%) hue-rotate(191deg) brightness(95%) contrast(89%)',
          opacity: 0.3
        }}
      />
    </div>
  );
};

export default LoadingIcon;
