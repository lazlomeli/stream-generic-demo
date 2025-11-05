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

/**
 * Generates a unique DiceBear avatar URL based on a seed (userId or userName)
 * @param seed - A unique identifier (userId or userName) to generate the avatar
 * @returns The DiceBear avatar URL
 */
export function generateAvatarUrl(seed: string): string {
  // Select a style deterministically based on the seed
  const charCode = seed.charCodeAt(0);
  const styleIndex = charCode % avatarStyles.length;
  const avatarStyle = avatarStyles[styleIndex];
  
  return `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(seed)}`;
}

