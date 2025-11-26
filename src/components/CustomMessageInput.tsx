import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageInput, useChannelStateContext } from 'stream-chat-react';
import type { SendButtonProps } from 'stream-chat-react';
import { useResponsive } from '../contexts/ResponsiveContext';
import CubePlusIcon from '../icons/cube-plus.svg';
import SendMsgIcon from '../icons/send-msg.svg';
import CustomAttachment1 from '../assets/custom-attachment-1.png';
import CustomAttachment2 from '../assets/custom-attachment-2.png';

// Custom Send Button - receives sendMessage prop automatically
const CustomSendButton: React.FC<SendButtonProps> = ({ sendMessage, ...rest }) => {
  const { isMobileView } = useResponsive();
  
  return (
    <button
      className="custom-send-button"
      onClick={sendMessage}
      title={isMobileView ? undefined : "Send message"}
      type="button"
      {...rest}
    >
      <img 
        src={SendMsgIcon} 
        alt="Send" 
        width={16} 
        height={16}
      />
    </button>
  );
};

const CustomMessageInput: React.FC = (props) => {
  const [lastAttachmentSent, setLastAttachmentSent] = useState<1 | 2 | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<{ 1: string | null; 2: string | null }>({ 1: null, 2: null });
  const [isAudioRecorderVisible, setIsAudioRecorderVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { channel } = useChannelStateContext();
  const { isMobileView } = useResponsive();

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

  // Monitor for audio recorder visibility
  useEffect(() => {
    const checkAudioRecorder = () => {
      const audioRecorder = document.querySelector('.str-chat__audio_recorder-container');
      setIsAudioRecorderVisible(!!audioRecorder);
    };

    // Initial check
    checkAudioRecorder();

    // Create a MutationObserver to watch for DOM changes
    const observer = new MutationObserver(checkAudioRecorder);

    // Observe the container and its children
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="custom-message-input" ref={containerRef}>
      <div className="message-input-wrapper">
        <MessageInput 
          {...props}
          audioRecordingEnabled={true}
          // grow={true}
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
          style={{ display: isAudioRecorderVisible ? 'none' : 'flex' }}
        >
          <img 
            src={CubePlusIcon} 
            alt="Custom Attachment" 
            width={20} 
            height={20}
          />
        </button>
      </div>
    </div>
  );
};

export { CustomSendButton, CustomMessageInput };