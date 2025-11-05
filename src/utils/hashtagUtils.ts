/**
 * Hashtag utility functions for Stream Feeds
 */

const MAX_HASHTAGS = 10;

/**
 * Extract hashtags from text
 * @param text - The text to extract hashtags from
 * @returns Array of normalized hashtag strings (without #)
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  
  const regex = /#(\w+)/g;
  const matches = text.matchAll(regex);
  const hashtags = [...matches].map(match => match[1].toLowerCase());
  
  // Remove duplicates and validate
  const uniqueHashtags = [...new Set(hashtags)]
    .filter(isValidHashtag)
    .slice(0, MAX_HASHTAGS);
  
  return uniqueHashtags;
}

/**
 * Validate a hashtag
 * @param hashtag - The hashtag to validate (without #)
 * @returns true if valid, false otherwise
 */
export function isValidHashtag(hashtag: string): boolean {
  // Only alphanumeric and underscores, 2-50 characters
  const regex = /^[a-zA-Z0-9_]{2,50}$/;
  return regex.test(hashtag);
}

/**
 * Normalize a hashtag
 * @param hashtag - The hashtag to normalize
 * @returns Normalized hashtag (lowercase, trimmed)
 */
export function normalizeHashtag(hashtag: string): string {
  return hashtag.toLowerCase().trim();
}
