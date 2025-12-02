import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUILayout } from '../App';
import CloseIcon from '../icons/logout-2.svg';
import './EmbeddedCall.css';

const EmbeddedCall: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideHeader } = useUILayout();
  
  const callUrl = useMemo(() => {
    const callId = Math.floor(Math.random() * 100000000);
    return `https://pronto.getstream.io/join/${callId}`;
  }, []);
  
  const returnPath = searchParams.get('return') || '/chat';

  useEffect(() => {
    setHideHeader(true);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  const handleClose = () => {
    navigate(returnPath);
  };

  return (
    <div className="embedded-call-container">
      <div className="embedded-call-header">
        <div className="embedded-call-title">
          <span className="call-indicator" />
          Video Call
        </div>
        <button 
          className="embedded-call-close" 
          onClick={handleClose}
          title="End call and return"
        >
          <img src={CloseIcon} alt="Close" width="20" height="20" />
        </button>
      </div>
      <iframe
        src={callUrl}
        className="embedded-call-iframe"
        allow="camera; microphone; display-capture; autoplay; clipboard-write"
        allowFullScreen
        title="Video Call"
      />
    </div>
  );
};

export default EmbeddedCall;

