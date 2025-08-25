import React from 'react';
import LoadingCircles from '../icons/loading-circles.svg';

interface LoadingIconProps {
  size?: number;
  className?: string;
}

const LoadingIcon: React.FC<LoadingIconProps> = ({ size = 32, className = '' }) => {
  return (
    <div className={`loading-icon ${className}`} style={{ width: size, height: size }}>
      <img 
        src={LoadingCircles} 
        alt="Loading..." 
        width="100%" 
        height="100%"
        style={{ 
          filter: 'hue-rotate(200deg) saturate(0.8) brightness(1.2)',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default LoadingIcon;
