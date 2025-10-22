/**
 * Sample user type definition
 */
export interface SampleUser {
  id: string;
  name: string;
  role: string;
  image: string;
}

/**
 * Generate sample user data (shared between Chat and Feeds)
 */
export function generateSampleUsers(): SampleUser[];

