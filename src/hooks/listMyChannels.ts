// @ts-nocheck
import { StreamChat, type ChannelFilters } from "stream-chat";

export type ChannelItem = {
  id: string;
  name?: string;
  type: "group" | "dm";
  image?: string;
  status: "online" | "away" | "offline";
  lastMessage?: string;
  lastMessageTime?: string;
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
      image: c.data?.image as string | undefined,
      lastMessage: last?.text,
      lastMessageTime: last?.created_at ? new Date(last.created_at).toLocaleTimeString() : undefined,
    };
  });
}