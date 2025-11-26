import React, { useState } from 'react'
import videoLoop from '../assets/video-loop.mov'
import InfinityIcon from '../icons/infinity.svg'
import RecordingIcon from '../icons/player-record-on.svg'
import WorldBoltIcon from '../icons/world-bolt.svg'
import RocketIcon from '../icons/rocket.svg'
import CaretIcon from '../icons/caret.svg'
import StreamIcon from '../icons/stream.svg'
import './LivestreamSetup.css'

interface LivestreamSetupProps {
  onSetupComplete: (config: {
    streamType: 'webrtc' | 'rtmp'
    streamKey?: string
    streamUrl?: string
  }) => void
}

const LivestreamSetup: React.FC<LivestreamSetupProps> = ({ onSetupComplete }) => {
  const [selectedType, setSelectedType] = useState<'webrtc' | 'rtmp' | null>(null)
  const [streamKey, setStreamKey] = useState('')
  const [streamUrl, setStreamUrl] = useState('')

  const handleOptionSelect = (type: 'webrtc' | 'rtmp') => {
    setSelectedType(type)
    
    if (type === 'webrtc') {
      onSetupComplete({
        streamType: type
      })
    }
  }

  const handleRtmpContinue = () => {
    if (selectedType === 'rtmp' && streamKey.trim() && streamUrl.trim()) {
      onSetupComplete({
        streamType: 'rtmp',
        streamKey,
        streamUrl
      })
    }
  }

  const handleGoBack = () => {
    window.location.href = '/feeds'
  }

  return (
    <div className="livestream-setup">
      <video 
        className="video-background"
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={videoLoop} type="video/mp4" />
        <source src={videoLoop} type="video/quicktime" />
      </video>
      
      <div className="setup-back">
        <button className="back-btn" onClick={handleGoBack}>
          <img src={CaretIcon} alt="Go Back" className="back-icon" />
        </button>
      </div>

      <div className="setup-container">
        <div className="setup-options">
          <div 
            className={`setup-option ${selectedType === 'webrtc' ? 'selected' : ''}`}
            onClick={() => handleOptionSelect('webrtc')}
          >
            <div className="option-badge webrtc-badge">
              ULTRA-LOW LATENCY • RECOMMENDED
            </div>
            <div className="option-content">
              <h3>WebRTC</h3>
              <p>Select this option for low-latency and highest quality between the host and the viewers. Supports all platforms.</p>
            </div>
          </div>

          <div 
            className={`setup-option rtmp-disabled`}
          >
            <div className="option-badge rtmp-badge">
              SLOWER + MORE SETUP
            </div>
            <div className="option-content">
              <h3>RTMP</h3>
              <p>Select this option if you want to use dedicated software (like OBS) with only a small delay for buffering added to the broadcast.</p>
            </div>
          </div>
        </div>

        <div className="feature-highlights">
          <div className="feature-item">
            <div className="feature-header">
              <img src={WorldBoltIcon} alt="Ultra low-latency streaming" />
              <h4>Ultra low-latency streaming</h4>
            </div>
            <p>Stream's global edge network provides best-in-class live streaming with the slowest delays between you and your audience.</p>
          </div>
          <div className="feature-item">
            <div className="feature-header">
              <img src={InfinityIcon} alt="Broadcast anywhere" />
              <h4>Broadcast anywhere</h4>
            </div>
            <p>Multi-platform streaming to YouTube, Twitch or any platform that supports RTMP.</p>
          </div>
          <div className="feature-item">
            <div className="feature-header">
              <img src={RecordingIcon} alt="Recording & transcription" />
              <h4>Recording & transcription</h4>
            </div>
            <p>Capture every moment with built-in recording and accurate transcription.</p>
          </div>
          <div className="feature-item">
            <div className="feature-header">
              <img src={RocketIcon} alt="Adaptive streaming" />
              <h4>Adaptive streaming</h4>
            </div>
            <p>Built-in redundancy to always display the highest quality to viewers.</p>
          </div>
        </div>

        {selectedType === 'rtmp' && (
          <div className="rtmp-config">
            <h3>RTMP Configuration</h3>
            <div className="livestream-form-group">
              <label htmlFor="streamUrl">Stream URL</label>
              <input
                id="streamUrl"
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="rtmp://your-stream-server.com/live"
                className="livestream-form-input"
              />
            </div>
            <div className="livestream-form-group">
              <label htmlFor="streamKey">Stream Key</label>
              <input
                id="streamKey"
                type="text"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="Your stream key"
                className="livestream-form-input"
              />
            </div>
            <div className="rtmp-help">
              <p>💡 <strong>How to get these values:</strong></p>
              <ol>
                <li>Open your streaming software (OBS Studio, Streamlabs, etc.)</li>
                <li>Go to Settings → Stream</li>
                <li>Copy the Server URL and Stream Key from there</li>
              </ol>
            </div>
            <div className="setup-actions">
              <button 
                className={`continue-btn ${streamKey.trim() && streamUrl.trim() ? 'enabled' : 'disabled'}`}
                onClick={handleRtmpContinue}
                disabled={!streamKey.trim() || !streamUrl.trim()}
              >
                Continue with RTMP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LivestreamSetup
