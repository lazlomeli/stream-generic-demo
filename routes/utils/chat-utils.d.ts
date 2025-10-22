import { StreamChat } from 'stream-chat';

/**
 * Reset Chat - Delete all channels (keep users intact)
 */
export function resetChat(client: StreamChat): Promise<{
  success: boolean;
  message: string;
}>;

/**
 * Seed Chat - Create sample users and channels
 */
export function seedChat(client: StreamChat, currentUserId: string): Promise<{
  success: boolean;
  message: string;
  data: {
    groupChannel: string;
    dmChannels: string[];
    sampleUsers: string[];
  };
}>;

