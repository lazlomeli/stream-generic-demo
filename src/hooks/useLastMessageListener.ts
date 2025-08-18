import { useEffect, useRef } from "react";
import type { StreamChat } from "stream-chat";
import type { ChannelItem } from "./listMyChannels"

export function useLastMessageListener(
  client: StreamChat | null,
  setChannels: React.Dispatch<React.SetStateAction<ChannelItem[]>>
) {
  const handlerRef = useRef<(e: any) => void>();
  useEffect(() => {
    if (!client) return;

    handlerRef.current = (e) => {
      const chId = e.channel?.id || e.channel_id;
      const text = e.message?.text || e.text || "";
      const time = e.message?.created_at || e.created_at || Date.now();

      setChannels((prev) =>
        prev.map((c) =>
          c.id === chId ? { ...c, lastMessage: text, lastMessageTime: new Date(time).toLocaleTimeString() } : c
        )
      );
    };

    const h = (ev: any) => handlerRef.current?.(ev);
    client.on("message.new", h);
    return () => client.off("message.new", h);
  }, [client, setChannels]);
}
