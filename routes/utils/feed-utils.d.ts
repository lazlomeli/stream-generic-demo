import { StreamClient } from '@stream-io/node-sdk';

/**
 * Reset Feeds - Delete all activities, reactions, comments, and follows (keep users intact)
 */
export function resetFeeds(client: StreamClient): Promise<{
  success: boolean;
  message: string;
}>;

/**
 * Seed Feeds - Create sample users, activities, reactions, comments, and follows
 */
export function seedFeeds(client: StreamClient, currentUserId: string): Promise<{
  success: boolean;
  message: string;
  data: {
    feeds: string[];
    activities: string[];
    sampleUsers: string[];
  };
}>;

