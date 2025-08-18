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
  const { channels, seedAndLoad } = useDemoChannels(streamClient, currentUserId);

  useEffect(() => {
    seedAndLoad();
  }, [seedAndLoad]);

  useEffect(() => {
    onChannelsCreated(channels);
  }, [channels, onChannelsCreated]);

  return null;
};

export default SampleChannels;
