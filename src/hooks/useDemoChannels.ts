import React from "react";
import type { StreamChat } from "stream-chat";
import { listMyChannels, type ChannelItem } from "./listMyChannels";
import { useLastMessageListener } from "./useLastMessageListener";

export function useDemoChannels(
  chatClient: StreamChat | null,
  userId: string | undefined
) {
  // Removed getAccessTokenSilently - no longer needed for auto-seeding
  const [channels, setChannels] = React.useState<ChannelItem[]>([]);

  useLastMessageListener(chatClient, setChannels);

  const loadChannels = React.useCallback(async () => {
    if (!chatClient || !userId) return;

    // Just load channels - NO automatic seeding
    const list = await listMyChannels(chatClient, userId);
    setChannels(list);
  }, [chatClient, userId]);

  return { channels, loadChannels };
}
