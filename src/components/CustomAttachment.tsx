import React, { useState, useRef, useEffect } from 'react';
import { Attachment, AttachmentProps } from 'stream-chat-react';
import './VoiceRecording.css';

import PlayerPlayIcon from '../icons/player-play.svg';

interface VoiceRecordingAttachment {
  type: 'voiceRecording';
  asset_url: string;
  mime_type: string;
  file_size: number;
  duration: number;
  title: string;
  waveform_data?: number[];
}

const VoiceRecordingPlayer: React.FC<{ attachment: VoiceRecordingAttachment }> = ({ attachment }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playbackRates = [0.5, 1, 1.5, 2];

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * attachment.duration;
    
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const changePlaybackRate = () => {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % playbackRates.length;
    const newRate = playbackRates[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="voice-recording-player">
      <audio
        ref={audioRef}
        src={attachment.asset_url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      <div className="voice-recording-header">
        <button
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlayback}
        >
          <img src={PlayerPlayIcon} alt="Play" width={16} height={16} />
        </button>
        
        <div className="voice-recording-info">
          <div className="voice-recording-title">
            {attachment.title || 'Voice Message'}
          </div>
          <div className="voice-recording-duration">
            {attachment.duration ? formatTime(attachment.duration) : formatFileSize(attachment.file_size)}
          </div>
        </div>

        {isPlaying && (
          <button
            className="playback-rate-button"
            onClick={changePlaybackRate}
            title={`Playback rate: ${playbackRate}x`}
          >
            {playbackRate}x
          </button>
        )}
      </div>

      {attachment.waveform_data && attachment.waveform_data.length > 0 && (
        <div className="waveform-container" onClick={handleSeek}>
          <div className="waveform-progress" style={{ width: `${(currentTime / attachment.duration) * 100}%` }} />
          {attachment.waveform_data.map((amplitude, index) => (
            <div
              key={index}
              className={`waveform-bar ${index < (currentTime / attachment.duration) * attachment.waveform_data!.length ? 'active' : ''}`}
              style={{ height: `${amplitude * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="voice-recording-footer">
        <span className="current-time">{formatTime(currentTime)}</span>
        <span className="total-time">{formatTime(attachment.duration)}</span>
      </div>
    </div>
  );
};

const QuotedVoiceRecording: React.FC<{ attachment: VoiceRecordingAttachment }> = ({ attachment }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="quoted-voice-recording">
      <div className="quoted-voice-icon">🎤</div>
      <div className="quoted-voice-info">
        <div className="quoted-voice-title">
          {attachment.title || 'Voice Message'}
        </div>
        <div className="quoted-voice-duration">
          {attachment.duration ? formatTime(attachment.duration) : formatFileSize(attachment.file_size)}
        </div>
      </div>
    </div>
  );
};

const CustomVoiceRecording: React.FC<{ attachment: VoiceRecordingAttachment; isQuoted?: boolean }> = ({ 
  attachment, 
  isQuoted = false 
}) => {
  if (isQuoted) {
    return <QuotedVoiceRecording attachment={attachment} />;
  }
  
  return <VoiceRecordingPlayer attachment={attachment} />;
};

const CustomAttachment: React.FC<AttachmentProps> = (props) => {
  const voiceRecordingAttachment = props.attachments?.find(att => 
    'type' in att && att.type === 'voiceRecording'
  );
  
  if (voiceRecordingAttachment && 'type' in voiceRecordingAttachment) {
    return (
      <CustomVoiceRecording 
        attachment={voiceRecordingAttachment as VoiceRecordingAttachment}
        isQuoted={props.isQuoted}
      />
    );
  }
  return <Attachment {...props} />;
};

export default CustomAttachment;
