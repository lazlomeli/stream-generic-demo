// @ts-nocheck
import { StreamChat, type ChannelFilters } from "stream-chat";
import { get } from 'lodash'

export type ChannelItem = {
  id: string;
  name?: string;
  type: "group" | "dm";
  image?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  status?: 'online' | 'away' | 'offline';
  onlineCount?: number;
  muted?: boolean;
};

export async function listMyChannels(client: StreamChat, me: string): Promise<ChannelItem[]> {
  // Only query for regular chat channels by filtering on channelType
  const filters: ChannelFilters = { 
    type: "messaging", 
    members: { $in: [me] },
    // @ts-ignore - channelType is a custom field we add to channel data
    channelType: 'chat' // Only get regular chat channels, excludes livestream channels
  };

  const channels = await client.queryChannels(filters, { last_message_at: -1 }, { watch: true, state: true });

  return channels.map((c) => {
    const last = c.state.messages.at(-1);
    const memberCount = Object.keys(c.state?.members || {}).length;
    const isDM = c.data?.isDM === true;
    
    let lastMessage = last?.text;
    
    if (!lastMessage && last?.attachments?.length > 0) {
      const attachment = last.attachments[0];
      
      switch (attachment.type) {
        case 'voiceRecording':
          lastMessage = last.custom?.previewText || '🎤 Voice Message';
          break;
        case 'poll':
          lastMessage = '📊 Poll';
          break;
        case 'image':
          lastMessage = '📷 Photo';
          break;
        case 'video':
          lastMessage = '🎥 Video';
          break;
        case 'file':
          lastMessage = '📎 File';
          break;
        case 'giphy':
          lastMessage = '🎬 GIF';
          break;
        default:
          lastMessage = '📎 Attachment';
          break;
      }
    }
    
    if (last?.text && last?.attachments?.length > 0) {
      const attachment = last.attachments[0];
      let attachmentIndicator = '';
      
      switch (attachment.type) {
        case 'voiceRecording':
          break;
        case 'poll':
          attachmentIndicator = ' 📊';
          break;
        case 'image':
          attachmentIndicator = ' 📷';
          break;
        case 'video':
          attachmentIndicator = ' 🎥';
          break;
        case 'file':
          attachmentIndicator = ' 📎';
          break;
        case 'giphy':
          attachmentIndicator = ' 🎬';
          break;
      }
      
      if (attachmentIndicator) {
        lastMessage = last.text + attachmentIndicator;
      }
    }

    if (lastMessage && last?.user) {
      const senderName = last.user.name || last.user.id;
      const isOwnMessage = last.user.id === me;

      lastMessage = isOwnMessage ? `You: ${lastMessage}` : `${senderName}: ${lastMessage}`;
    }

    const members = c.state?.members || {};
    const onlineUsers = Object.values(members).filter(member => 
      member.user?.online === true
    );
    const onlineCount = onlineUsers.length;
    
    const otherUsersOnline = onlineUsers.filter(member => 
      member.user?.id !== me
    );
    const otherUsersOnlineCount = otherUsersOnline.length;
    
    const getChannelStatus = () => {
      if (isDM) {
        return otherUsersOnlineCount > 0 ? 'online' : 'offline';
      } else {
        if (otherUsersOnlineCount > 0) {
          return 'online'; 
        } else if (onlineCount === 1) {
          return 'away';
        } else {
          return 'offline'; 
        }
      }
    };

    // For DM channels only, get the other user's image
    // For group channels, don't set an image (force fallback icon)
    let channelImage: string | undefined = undefined;
    if (isDM) {
      // Find the other user (not the current user)
      const otherUser = Object.values(members).find(member => 
        member.user?.id !== me
      );
      if (otherUser?.user?.image) {
        channelImage = otherUser.user.image;
      }
    }

    const channelItem = {
      id: c.id!,
      name: c.data?.name ?? "Channel",
      type: isDM ? "dm" : "group",
      image: channelImage,
      lastMessage: lastMessage,
      lastMessageTime: last?.created_at ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      status: getChannelStatus(),
      onlineCount: onlineCount,
      muted: c.muteStatus()?.muted || false,
    };
    
    return channelItem;
  });
}