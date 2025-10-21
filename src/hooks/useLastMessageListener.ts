import { useEffect, useRef } from "react";
import type { StreamChat } from "stream-chat";
import type { ChannelItem } from "./listMyChannels";
import { getMessagePreview, formatMessageWithSender } from '../utils/messageUtils';

export function useLastMessageListener(
  client: StreamChat | null,
  setChannels: React.Dispatch<React.SetStateAction<ChannelItem[]>>
) {
  const handlerRef = useRef<(e: any) => void>();
  useEffect(() => {
    if (!client) return;

    handlerRef.current = (e) => {
      const chId = e.channel?.id || e.channel_id;
      const message = e.message;
      
      if (!message || !chId) return;

      // Get message preview using utility function
      let preview = getMessagePreview(message);
      
      // Add sender name prefix using utility function
      if (preview && message.user) {
        preview = formatMessageWithSender(
          preview,
          message.user.id,
          message.user.name,
          client.userID || ''
        );
      }

      const time = message.created_at || Date.now();
      const formattedTime = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setChannels((prev) => {
        // Find the channel and update it
        const updatedChannels = prev.map((c) =>
          c.id === chId 
            ? { ...c, lastMessage: preview, lastMessageTime: formattedTime }
            : c
        );
        
        // Reorder: move the updated channel to the top
        const channelIndex = updatedChannels.findIndex(c => c.id === chId);
        if (channelIndex > 0) {
          const [movedChannel] = updatedChannels.splice(channelIndex, 1);
          updatedChannels.unshift(movedChannel);
        }
        
        return updatedChannels;
      });
    };

    const h = (ev: any) => handlerRef.current?.(ev);
    
    // Listen to both new and updated messages
    client.on("message.new", h);
    client.on("message.updated", h);
    
    return () => {
      client.off("message.new", h);
      client.off("message.updated", h);
    };
  }, [client, setChannels]);
}
