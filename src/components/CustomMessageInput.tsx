import React, { useState, useRef, useCallback } from 'react';
import { MessageInput, useMessageInputContext, useChannelStateContext } from 'stream-chat-react';
import { useResponsive } from '../contexts/ResponsiveContext';
import './VoiceRecording.css';
import MicrophoneIcon from '../icons/microphone.svg';
import StopIcon from '../icons/stop.svg';
import SendIcon from '../icons/send.svg';
import CubePlusIcon from '../icons/cube-plus.svg';
import SendMsgIcon from '../icons/send-msg.svg';
import CustomAttachment1 from '../assets/custom-attachment-1.png';
import CustomAttachment2 from '../assets/custom-attachment-2.png';


const CustomMessageInput: React.FC = (props) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [lastAttachmentSent, setLastAttachmentSent] = useState<1 | 2 | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<{ 1: string | null; 2: string | null }>({ 1: null, 2: null });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { channel } = useChannelStateContext();
  const { isMobileView } = useResponsive();
  
  const messageInputContext = useMessageInputContext();

  const getOrUploadImageToStream = useCallback(async (attachmentNumber: 1 | 2) => {
    if (uploadedImageUrls[attachmentNumber]) {
      return uploadedImageUrls[attachmentNumber]!;
    }

    try {
      const imageUrl = attachmentNumber === 1 ? CustomAttachment1 : CustomAttachment2;
      const filename = `custom-attachment-${attachmentNumber}.png`;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      
      const uploadResponse = await channel.sendImage(file);
      const streamUrl = uploadResponse.file;
      
      setUploadedImageUrls(prev => ({ ...prev, [attachmentNumber]: streamUrl }));
      
      return streamUrl;
    } catch (error) {
      console.error(`Error uploading attachment ${attachmentNumber} to Stream:`, error);
      throw error;
    }
  }, [channel, uploadedImageUrls]);

  const handleCustomAttachment = useCallback(async () => {
    try {
      const attachmentToSend = lastAttachmentSent === 1 ? 2 : 1;
      const filename = `custom-attachment-${attachmentToSend}.png`;

      if (channel) {
        const streamImageUrl = await getOrUploadImageToStream(attachmentToSend);
        
        await channel.sendMessage({
          attachments: [
            {
              type: 'image',
              image_url: streamImageUrl,
              thumb_url: streamImageUrl,
              title: filename,
              fallback: filename,
            },
          ],
        });

        setLastAttachmentSent(attachmentToSend);
      } else {
        console.error('Channel not available for sending custom attachment');
        alert('Unable to send custom attachment. Please try again.');
      }
    } catch (error) {
      console.error('Error sending custom attachment:', error);
      alert('Failed to send custom attachment. Please try again.');
    }
  }, [lastAttachmentSent, channel, getOrUploadImageToStream]);

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
      const event = new CustomEvent('voiceMessageReady', {
        detail: {
          audioBlob,
          duration: recordingTime,
          size: audioBlob.size
        }
      });
      window.dispatchEvent(event);

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

  const handleSendMessage = useCallback(() => {
    if (messageInputContext?.handleSubmit) {
      messageInputContext.handleSubmit();
    }
  }, [messageInputContext]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="custom-message-input" ref={containerRef}>
      <div className="message-input-wrapper">
        <MessageInput 
          {...props} 
          additionalTextareaProps={{
            placeholder: "Type a message..."
          }}
        />
        
        <button
          className="custom-attachment-button-external"
          onClick={handleCustomAttachment}
          title={isMobileView ? undefined : "Custom Attachment"}
          type="button"
          data-tooltip={isMobileView ? undefined : "Custom Attachment"}
        >
          <img 
            src={CubePlusIcon} 
            alt="Custom Attachment" 
            width={20} 
            height={20}
          />
        </button>

        {!isRecording && !audioBlob && (
          <button
            className="voice-record-button-integrated"
            onClick={startRecording}
            title="Record voice message"
          >
            <img 
              src={MicrophoneIcon} 
              alt="Microphone" 
              width={16} 
              height={16} 
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </button>
        )}

        <button
          className="custom-send-button"
          onClick={handleSendMessage}
          title="Send message"
          type="button"
        >
          <img 
            src={SendMsgIcon} 
            alt="Send" 
            width={16} 
            height={16}
          />
        </button>
      </div>
      
      {(isRecording || audioBlob) && (
        <div className="voice-recording-controls-integrated">
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
      )}

    </div>
  );
};

export default CustomMessageInput;
