import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import type { StreamChat } from "stream-chat";
import { listMyChannels, type ChannelItem } from "./listMyChannels";
import { useLastMessageListener } from "./useLastMessageListener";

export function useDemoChannels(
  chatClient: StreamChat | null,
  userId: string | undefined
) {
  const { getAccessTokenSilently } = useAuth0();
  const [channels, setChannels] = React.useState<ChannelItem[]>([]);
  const seededForUserRef = React.useRef<string | null>(null);

  useLastMessageListener(chatClient, setChannels);

  const seedAndLoad = React.useCallback(async () => {
    if (!chatClient || !userId) return;

    // seed only once per userId
    if (seededForUserRef.current !== userId) {
      const at = await getAccessTokenSilently();
      const res = await fetch("/api/stream/seed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${at}`,
        },
        body: JSON.stringify({ userId }), // <-- IMPORTANT
      });
      if (!res.ok) {
        // not fatal for listing; log and continue
        console.warn("seed failed", res.status, await res.text());
      } else {
        seededForUserRef.current = userId;
      }
    }

    const list = await listMyChannels(chatClient, userId);
    setChannels(list);
  }, [chatClient, userId, getAccessTokenSilently]);

  return { channels, seedAndLoad };
}
