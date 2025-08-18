// @ts-nocheck
import { StreamChat, type ChannelFilters } from "stream-chat";

export type ChannelItem = {
  id: string;
  name?: string;
  type: "group" | "dm";
  image?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  status?: string;
};

export async function listMyChannels(client: StreamChat, me: string): Promise<ChannelItem[]> {
  const filters: ChannelFilters = { type: "messaging", members: { $in: [me] } };

  const channels = await client.queryChannels(filters, { last_message_at: -1 }, { watch: false, state: true });

  return channels.map((c) => {
    const last = c.state.messages.at(-1);
    const isDM = (c.state.members?.size ?? 0) === 2;
    
    return {
      id: c.id!,
      name: isDM ? c.data?.name : c.data?.name ?? "General",
      type: isDM ? "dm" : "group",
      image: c.data?.name === 'General' ? 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?&w=150&h=150&fit=crop&crop=faces' : c.data?.image,
      lastMessage: last?.text,
      lastMessageTime: last?.created_at ? new Date(last.created_at).toLocaleTimeString() : undefined,
    };
  });
}