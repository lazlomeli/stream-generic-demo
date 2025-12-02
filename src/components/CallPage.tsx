import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUILayout } from '../App';
import { useResponsive } from '../contexts/ResponsiveContext';
import CloseIcon from '../icons/logout-2.svg';
import './CallPage.css';

const CallPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setHideHeader } = useUILayout();
  const { isMobileView } = useResponsive();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const returnPath = searchParams.get('return') || '/chat';

  const callUrl = useMemo(() => {
    const callId = Math.floor(Math.random() * 100000000);
    const url = `https://pronto.getstream.io/join/${callId}`;
    console.log('🎥 Pronto Call URL:', url);
    return url;
  }, []);

  useEffect(() => {
    setHideHeader(true);
    console.log('📍 Current origin:', window.location.origin);
    console.log('📍 Current URL:', window.location.href);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  const handleClose = () => {
    navigate(returnPath);
  };

  const handleIframeLoad = () => {
    console.log('✅ Iframe loaded successfully');
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('❌ Iframe failed to load');
    setHasError(true);
    setIsLoading(false);
  };

  const handleOpenInNewTab = () => {
    window.open(callUrl, '_blank');
  };

  return (
    <div className={`embedded-call-container ${isMobileView ? 'mobile-call' : ''}`}>
      <div className="embedded-call-header">
        <div className="embedded-call-title">
          <span className="call-indicator" />
          Video Call
          {isLoading && <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.7 }}>Loading...</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="embedded-call-open-tab"
            onClick={handleOpenInNewTab}
            title="Open in new tab"
            style={{
              padding: '8px 12px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Open in Tab
          </button>
          <button 
            className="embedded-call-close" 
            onClick={handleClose}
            title="End call and return"
          >
            <img src={CloseIcon} alt="Close" width="20" height="20" />
          </button>
        </div>
      </div>
      
      {hasError && (
        <div style={{ 
          padding: 20, 
          textAlign: 'center', 
          color: '#fff',
          background: 'rgba(239, 68, 68, 0.1)',
          margin: 20,
          borderRadius: 8
        }}>
          <p>Unable to embed the call. This might be due to iframe restrictions.</p>
          <button 
            onClick={handleOpenInNewTab}
            style={{
              marginTop: 12,
              padding: '10px 20px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Open Call in New Tab
          </button>
        </div>
      )}
      
      <iframe
        src={callUrl}
        className="embedded-call-iframe"
        allow="camera; microphone; display-capture; autoplay; clipboard-write"
        allowFullScreen
        title="Video Call"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{ display: hasError ? 'none' : 'block' }}
      />
    </div>
  );
};

export default CallPage;
