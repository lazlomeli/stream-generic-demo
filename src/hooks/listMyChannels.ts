// @ts-nocheck
import { StreamChat, type ChannelFilters } from "stream-chat";
import { get } from 'lodash';
import { getMessagePreview, formatMessageWithSender } from '../utils/messageUtils';

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
  const filters: ChannelFilters = { 
    type: "messaging", 
    members: { $in: [me] },
    channelType: 'chat'
  };

  const channels = await client.queryChannels(filters, { last_message_at: -1 }, { watch: true, state: true });

  return channels.map((c) => {
    const last = c.state.messages.at(-1);
    const memberCount = Object.keys(c.state?.members || {}).length;
    const isDM = c.data?.isDM === true;
    
    let lastMessage = getMessagePreview(last);

    if (lastMessage && last?.user) {
      lastMessage = formatMessageWithSender(
        lastMessage,
        last.user.id,
        last.user.name,
        me
      );
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

    let channelImage: string | undefined = undefined;
    if (isDM) {
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