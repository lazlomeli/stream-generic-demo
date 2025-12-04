import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUILayout } from '../App';
import { useResponsive } from '../contexts/ResponsiveContext';
import VideoIcon from '../icons/video.svg';
import CloseIcon from '../icons/logout-2.svg';
import './CallPage.css';

const CallPage: React.FC = () => {
  const navigate = useNavigate();
  const { setHideHeader } = useUILayout();
  const { isMobileView } = useResponsive();
  const hasOpened = useRef(false);

  const callUrl = useMemo(() => {
    const callId = Math.floor(Math.random() * 100000000);
    return `https://pronto.getstream.io/join/${callId}`;
  }, []);

  useEffect(() => {
    setHideHeader(true);
    return () => setHideHeader(false);
  }, [setHideHeader]);

  const handleJoinCall = () => {
    if (hasOpened.current) return;
    hasOpened.current = true;
    
    if (isMobileView) {
      // iPhone 14 dimensions
      const width = 390;
      const height = 844;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        callUrl,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    } else {
      window.open(callUrl, '_blank');
    }
  };

  const handleBack = () => {
    navigate('/chat');
  };

  return (
    <div className="call-launch-container">
      <div className="call-launch-card">
        <div className="call-launch-icon">
          <img src={VideoIcon} alt="Video" width="48" height="48" />
        </div>
        <h2>Ready to join?</h2>
        <p>Click below to start your video call with Stream Pronto</p>
        <div className="call-launch-actions">
          <button className="call-launch-btn primary" onClick={handleJoinCall}>
            <span className="call-indicator" />
            Join Call
          </button>
          <button className="call-launch-btn secondary" onClick={handleBack}>
            <img src={CloseIcon} alt="Back" width="16" height="16" />
            Back to Chat
          </button>
        </div>
        <p className="call-launch-note">
          The call will open in a new tab for the best experience
        </p>
      </div>
    </div>
  );
};

export default CallPage;
