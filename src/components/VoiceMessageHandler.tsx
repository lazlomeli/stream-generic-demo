import React, { useCallback, useEffect } from 'react';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';

const VoiceMessageHandler: React.FC = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();

  // Handle voice message events
  const handleVoiceMessage = useCallback(async (event: CustomEvent) => {
    const { audioBlob, duration, size } = event.detail;

    if (!client || !channel) {
      console.error('Client or channel not ready for voice message');
      return;
    }

    try {
      console.log('Processing voice message:', { duration, size });
      
      // Create a file from the blob for Stream Chat upload
      const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      
      console.log('Uploading voice message to Stream Chat:', file.name, file.size);

      // Upload the file to Stream Chat
      const uploadResponse = await channel.sendFile(file, 'voice-message.webm', 'audio/webm');
      
      if (!uploadResponse) {
        throw new Error('File upload failed');
      }

      console.log('File uploaded successfully:', uploadResponse);

      // Send the voice message with the uploaded file URL
      const response = await channel.sendMessage({
        text: '🎤 Voice Message', // Add text for the message
        attachments: [
          {
            type: 'voiceRecording',
            asset_url: uploadResponse.file, // Use the uploaded file URL
            mime_type: 'audio/webm',
            file_size: size,
            duration: duration,
            title: 'Voice Message',
            waveform_data: Array.from({ length: 50 }, () => Math.random() * 0.8 + 0.2), // Generate mock waveform data
          }
        ]
      });

      console.log('Voice message sent successfully:', response);
      
      // Force channel refresh to ensure message appears
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

  // Listen for voice message events
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

  // This component doesn't render anything, it just handles voice message events
  return null;
};

export default VoiceMessageHandler;
