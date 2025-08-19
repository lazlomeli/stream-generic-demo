import React from 'react';
import './VoiceRecording.css';

const VoiceRecordingDemo: React.FC = () => {
  return (
    <div className="voice-recording-demo">
      <div className="demo-header">
        <h3>🎤 Voice Recording Demo</h3>
        <p>Use the microphone button below the message input to record voice messages</p>
      </div>
      
      <div className="demo-features">
        <div className="feature-item">
          <span className="feature-icon">🎙️</span>
          <span>Click microphone to start recording</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">⏹️</span>
          <span>Click stop to finish recording</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">▶️</span>
          <span>Preview and send your voice message</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">📊</span>
          <span>Visual waveform with seek functionality</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">⚡</span>
          <span>Adjustable playback speed</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecordingDemo;
