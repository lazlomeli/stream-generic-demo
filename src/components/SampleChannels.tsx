import React, { useEffect } from "react";
import type { StreamChat } from "stream-chat";
import { useDemoChannels } from "../hooks/useDemoChannels"
import type { ChannelItem } from "../hooks/listMyChannels";

interface Props {
  streamClient: StreamChat | null;
  currentUserId: string | undefined;
  onChannelsCreated: (channels: ChannelItem[]) => void;
}

const SampleChannels: React.FC<Props> = ({ streamClient, currentUserId, onChannelsCreated }) => {
  const { channels, loadChannels } = useDemoChannels(streamClient, currentUserId);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    onChannelsCreated(channels);
  }, [channels, onChannelsCreated]);

  return null;
};

export default SampleChannels;
