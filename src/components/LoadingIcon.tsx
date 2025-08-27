import React from 'react';
import LoadingCircles from '../icons/loading-circles.svg';
import './LoadingIcon.css';

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
          width: '100%',
          height: '100%',
          filter: 'hue-rotate(240deg) saturate(1.2) brightness(1.1)'
        }}
      />
    </div>
  );
};

export default LoadingIcon;
