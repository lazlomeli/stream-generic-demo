/**
 * Shared sample user data for both Chat and Feeds
 * 
 * These users are permanent fixtures in the demo and are never deleted.
 * They are used to populate both Stream Chat and Activity Feeds with sample data.
 */
export function generateSampleUsers() {
  return [
    {
      id: 'sample_alice_2025',
      name: 'Alice Johnson',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Alice',
    },
    {
      id: 'sample_bob_2025',
      name: 'Bob Smith',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Bob',
    },
    {
      id: 'sample_charlie_2025',
      name: 'Charlie Brown',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Charlie',
    },
    {
      id: 'sample_diana_2025',
      name: 'Diana Prince',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Diana',
    },
    {
      id: 'sample_eve_2025',
      name: 'Eve Martinez',
      role: 'user',
      image: 'https://getstream.io/random_png/?name=Eve',
    },
  ];
}

