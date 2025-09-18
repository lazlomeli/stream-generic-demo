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
  const filters: ChannelFilters = { type: "messaging", members: { $in: [me] } };

  const channels = await client.queryChannels(filters, { last_message_at: -1 }, { watch: false, state: true });

  // Filter out livestream channels to prevent them from appearing in regular chat
  const regularChannels = channels.filter(channel => {
    const channelId = channel.id || '';
    
    // Exclude livestream channels based on their ID patterns:
    // 1. Channels starting with 'live-' (generated livestream channels)
    // 2. URL-based livestream IDs (usually contain specific patterns)
    const isLivestreamChannel = 
      channelId.startsWith('live-') || 
      channelId.includes('livestream') ||
      channelId.includes('stream-') ||
      // Additional pattern: check if channel has specific livestream metadata
      (channel.data?.isLivestreamChannel === true);
    
    if (isLivestreamChannel) {
      console.log(`🚫 Excluding livestream channel from chat list: ${channelId}`);
      return false;
    }
    
    return true;
  });

  return regularChannels.map((c) => {
    const last = c.state.messages.at(-1);
    // Fix: Use Object.keys to count members instead of relying on size property
    const memberCount = Object.keys(c.state?.members || {}).length;
    const isDM = memberCount === 2;
    


    // Handle voice messages for channel list preview
    let lastMessage = last?.text;
    
    // If no text but has voice recording attachment, show voice message preview
    if (!lastMessage && last?.attachments?.length > 0) {
      const voiceAttachment = last.attachments.find(att => att.type === 'voiceRecording');
      if (voiceAttachment) {
        // Use custom preview text if available, otherwise show default
        lastMessage = last.custom?.previewText || '🎤 Voice Message';
      }
    }

    // Calculate online users for status indicator
    const members = c.state?.members || {};
    const onlineUsers = Object.values(members).filter(member => 
      member.user?.online === true
    );
    const onlineCount = onlineUsers.length;
    
    // Check if other users (not the current user) are online
    const otherUsersOnline = onlineUsers.filter(member => 
      member.user?.id !== me
    );
    const otherUsersOnlineCount = otherUsersOnline.length;
    
    // Determine status based on channel type and online users
    const getChannelStatus = () => {
      if (isDM) {
        // For DM channels (2 users): green if other user is online, gray if not
        return otherUsersOnlineCount > 0 ? 'online' : 'offline';
      } else {
        // For group channels (>2 users)
        if (otherUsersOnlineCount > 0) {
          return 'online'; // Green: at least one other user is online
        } else if (onlineCount === 1) {
          return 'away'; // Yellow: only the logged user is online
        } else {
          return 'offline'; // Gray: no one is online
        }
      }
    };

    // For DM channels, get the other user's image; for groups, use channel image
    let channelImage = c.data?.image;
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