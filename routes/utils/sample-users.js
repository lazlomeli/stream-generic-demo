/**
 * Shared sample user data for both Chat and Feeds
 * 
 * These users are permanent fixtures in the demo and are never deleted.
 * They are used to populate both Stream Chat and Activity Feeds with sample data.
 */

/**
 * Generates a unique AI-generated avatar URL based on a seed (userId)
 * Matches the frontend generateAvatarUrl utility
 */
function generateAvatarUrl(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}-avatar/400/400`;
}

export function generateSampleUsers() {
  return [
    {
      id: 'sample_alice_2025',
      name: 'Alice Johnson',
      role: 'user',
      image: generateAvatarUrl('sample_alice_2025'),
    },
    {
      id: 'sample_bob_2025',
      name: 'Bob Smith',
      role: 'user',
      image: generateAvatarUrl('sample_bob_2025'),
    },
    {
      id: 'sample_charlie_2025',
      name: 'Charlie Brown',
      role: 'user',
      image: generateAvatarUrl('sample_charlie_2025'),
    },
    {
      id: 'sample_diana_2025',
      name: 'Diana Prince',
      role: 'user',
      image: generateAvatarUrl('sample_diana_2025'),
    },
    {
      id: 'sample_eve_2025',
      name: 'Eve Martinez',
      role: 'user',
      image: generateAvatarUrl('sample_eve_2025'),
    },
  ];
}

