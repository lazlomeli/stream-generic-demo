// DiceBear avatar styles for variety
const avatarStyles = [
  "avataaars",
  "bottts",
  "lorelei",
  "adventurer",
  "big-smile",
  "fun-emoji",
  "pixel-art",
  "thumbs",
];

// Gradient color combinations for profile banners
const bannerGradients = [
  { from: "#667eea", to: "#764ba2", angle: 135 }, // Purple Dream
  { from: "#f093fb", to: "#f5576c", angle: 135 }, // Pink Sunset
  { from: "#4facfe", to: "#00f2fe", angle: 135 }, // Ocean Blue
  { from: "#43e97b", to: "#38f9d7", angle: 135 }, // Mint Fresh
  { from: "#fa709a", to: "#fee140", angle: 135 }, // Sunset Orange
  { from: "#30cfd0", to: "#330867", angle: 135 }, // Deep Ocean
  { from: "#a8edea", to: "#fed6e3", angle: 135 }, // Pastel Dream
  { from: "#ff9a9e", to: "#fecfef", angle: 135 }, // Cotton Candy
  { from: "#ffecd2", to: "#fcb69f", angle: 135 }, // Peach
  { from: "#ff6e7f", to: "#bfe9ff", angle: 135 }, // Sunset to Sky
  { from: "#e0c3fc", to: "#8ec5fc", angle: 135 }, // Lavender Sky
  { from: "#f8b500", to: "#fceabb", angle: 135 }, // Golden Hour
  { from: "#667eea", to: "#f093fb", angle: 135 }, // Purple Pink
  { from: "#17ead9", to: "#6078ea", angle: 135 }, // Teal Purple
  { from: "#fbc2eb", to: "#a6c1ee", angle: 135 }, // Soft Rainbow
  { from: "#fdcbf1", to: "#e6dee9", angle: 135 }, // Blush
  { from: "#a1c4fd", to: "#c2e9fb", angle: 135 }, // Sky Blue
  { from: "#d299c2", to: "#fef9d7", angle: 135 }, // Mystic
  { from: "#89f7fe", to: "#66a6ff", angle: 135 }, // Arctic
  { from: "#feada6", to: "#f5efef", angle: 135 }, // Peach Cream
];

/**
 * Generates a unique AI-generated avatar URL based on a seed (userId or userName)
 * @param seed - A unique identifier (userId or userName) to generate the avatar
 * @returns The avatar image URL from Picsum Photos
 */
export function generateAvatarUrl(seed: string): string {
  // Use Picsum Photos for consistent AI-generated avatar images
  // Square format (400x400) optimized for avatar display
  // Appending '-avatar' to seed ensures different images for avatar vs banner
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}-avatar/400/400`;
}

// Bio templates for random generation
const bioTemplates = [
  "Building cool things with code ✨",
  "Coffee enthusiast ☕ | Tech lover 💻",
  "Making the web a better place 🌐",
  "Passionate about design & development 🎨",
  "Digital creator | Always learning 📚",
  "Coding by day, dreaming by night 🌙",
  "Turning ideas into reality 💡",
  "Open source contributor | Tech enthusiast 🚀",
  "Designer, developer, and dreamer ✨",
  "Life is better with good code 💻",
  "Creating digital experiences 🎯",
  "Tech geek | Problem solver 🧩",
  "Innovation starts here 💡",
  "Building the future, one line at a time 🚀",
  "Simplicity is the ultimate sophistication ✨",
  "Exploring the intersection of art and code 🎨",
  "Making pixels dance 💃",
  "Curious mind | Creative soul 🌟",
  "Learning, building, sharing 🔄",
  "Code, create, inspire 💫",
  "Crafting beautiful user experiences 🎭",
  "Always shipping 🚢",
  "Believer in the power of technology 🌟",
  "Living life one commit at a time 📝",
  "Passionate creator | Lifelong learner 📖",
];

/**
 * Generates a unique gradient banner CSS based on a seed (userId)
 * @param seed - A unique identifier (userId) to generate the banner
 * @returns The CSS gradient string
 */
export function generateBannerGradient(seed: string): string {
  // Create a hash from the seed to select a gradient
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const gradientIndex = Math.abs(hash) % bannerGradients.length;
  const gradient = bannerGradients[gradientIndex];
  
  return `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`;
}

/**
 * Generates a unique banner image URL based on a seed (userId)
 * Uses Picsum Photos with consistent image IDs for each user
 * @param seed - A unique identifier (userId) to generate the banner image
 * @returns The image URL
 */
export function generateBannerImage(seed: string): string {
  // Create a hash from the seed to select an image
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use a range of high-quality image IDs from Picsum (1-1000)
  const imageId = Math.abs(hash) % 1000 + 1;
  
  // Return Picsum URL with blur effect for aesthetic banner
  // Width: 1200px, Height: 400px for banner dimensions
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/400`;
}

/**
 * Generates a unique bio text based on a seed (userId)
 * @param seed - A unique identifier (userId) to generate the bio
 * @returns A bio string
 */
export function generateUserBio(seed: string): string {
  // Create a hash from the seed to select a bio
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const bioIndex = Math.abs(hash) % bioTemplates.length;
  return bioTemplates[bioIndex];
}

