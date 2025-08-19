import React, { useState, useRef, useCallback } from 'react';
import { MessageInput, useMessageInputContext } from 'stream-chat-react';
import './VoiceRecording.css';

// Import SVG icons
import MicrophoneIcon from '../icons/microphone.svg';
import StopIcon from '../icons/stop.svg';
import SendIcon from '../icons/send.svg';

interface CustomMessageInputProps {
  // Extend MessageInput props as needed
}

const CustomMessageInput: React.FC<CustomMessageInputProps> = (props) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const sendVoiceMessage = useCallback(async () => {
    if (!audioBlob) return;

    try {
      // For now, we'll use a custom event to communicate with the parent
      // This will be handled by the Chat component
      const event = new CustomEvent('voiceMessageReady', {
        detail: {
          audioBlob,
          duration: recordingTime,
          size: audioBlob.size
        }
      });
      window.dispatchEvent(event);

      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error preparing voice message:', error);
      alert('Failed to prepare voice message. Please try again.');
    }
  }, [audioBlob, recordingTime]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      setAudioBlob(null);
      setRecordingTime(0);
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="custom-message-input">
      <MessageInput 
        {...props} 
        additionalTextareaProps={{
          placeholder: "Type a message or record voice message..."
        }}
      />
      
      {/* Voice Recording Controls - Integrated into MessageInput */}
      <div className="voice-recording-controls-integrated">
        {!isRecording && !audioBlob && (
          <button
            className="voice-record-button-integrated"
            onClick={startRecording}
            title="Record voice message"
          >
            <img src={MicrophoneIcon} alt="Microphone" width={20} height={20} />
          </button>
        )}

        {isRecording && (
          <div className="recording-controls-integrated">
            <div className="recording-timer-integrated">{formatTime(recordingTime)}</div>
            <button
              className="stop-recording-button-integrated"
              onClick={stopRecording}
              title="Stop recording"
            >
              <img src={StopIcon} alt="Stop" width={20} height={20} />
            </button>
          </div>
        )}

        {audioBlob && !isRecording && (
          <div className="voice-preview-controls-integrated">
            <div className="voice-preview-info-integrated">
              <span className="voice-duration-integrated">{formatTime(recordingTime)}</span>
              <span className="voice-size-integrated">{(audioBlob.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
              className="send-voice-button-integrated"
              onClick={sendVoiceMessage}
              title="Send voice message"
            >
              <img src={SendIcon} alt="Send" width={16} height={16} />
            </button>
            <button
              className="cancel-voice-button-integrated"
              onClick={cancelRecording}
              title="Cancel voice message"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomMessageInput;
