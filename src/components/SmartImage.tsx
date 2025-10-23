import React, { useState, useEffect } from 'react';
import './SmartImage.css';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  title?: string;
}

const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className = '', title }) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setImageState('error');
      return;
    }

    setImageState('loading');
    
    const img = new Image();
    
    const handleLoad = () => {
      setImageSrc(src);
      setImageState('loaded');
    };
    
    const handleError = () => {
      console.error(`Image failed to load: ${src}`);
      setImageState('error');
    };

    img.onload = handleLoad;
    img.onerror = handleError;
    
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  const handlePlaceholderClick = () => {
    if (src) {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  if (imageState === 'loading') {
    return (
      <div className={`smart-image-loading ${className}`}>
        <div className="smart-image-spinner"></div>
        <span className="smart-image-loading-text">Loading image...</span>
      </div>
    );
  }

  if (imageState === 'error') {
    return (
      <div 
        className={`smart-image-placeholder ${className}`}
        onClick={handlePlaceholderClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePlaceholderClick();
          }
        }}
        title={title || alt}
      >
        <div className="smart-image-placeholder-content">
          <div className="smart-image-placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="smart-image-placeholder-text">
            <span className="smart-image-placeholder-title">Image unavailable</span>
            <span className="smart-image-placeholder-subtitle">Click to view original URL</span>
          </div>
          <div className="smart-image-placeholder-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z" fill="currentColor"/>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={imageSrc}
      alt={alt}
      className={`smart-image-loaded ${className}`}
      title={title}
    />
  );
};

export default SmartImage;
