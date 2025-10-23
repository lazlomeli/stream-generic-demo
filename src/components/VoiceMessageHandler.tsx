import React, { useCallback, useEffect } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';

const VoiceMessageHandler: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();

  const handleVoiceMessage = useCallback(async (event: CustomEvent) => {
    const { audioBlob } = event.detail;

    if (!client || !channel) {
      console.error('Client or channel not ready for voice message');
      return;
    }

    try {
      const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      
      const uploadResponse = await channel.sendFile(file, 'voice-message.webm', 'audio/webm');
      
      if (!uploadResponse) {
        throw new Error('File upload failed');
      }

      await channel.watch();
      
    } catch (error: any) {
      console.error('Error processing voice message:', error);
      
      if (error.message?.includes('max payload size')) {
        alert('Voice message too large. Please record a shorter message.');
      } else {
        alert('Failed to send voice message. Please try again.');
      }
    }
  }, [client, channel]);

  useEffect(() => {
    const handleVoiceMessageEvent = (event: Event) => {
      if (event instanceof CustomEvent && event.type === 'voiceMessageReady') {
        handleVoiceMessage(event);
      }
    };

    window.addEventListener('voiceMessageReady', handleVoiceMessageEvent);
    
    return () => {
      window.removeEventListener('voiceMessageReady', handleVoiceMessageEvent);
    };
  }, [handleVoiceMessage]);

  return null;
};

export default VoiceMessageHandler;
