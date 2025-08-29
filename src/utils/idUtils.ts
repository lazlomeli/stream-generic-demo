/**
 * Utility functions for handling user IDs securely
 */

/**
 * Creates a consistent, non-reversible hash from an Auth0 user ID
 * @param auth0UserId - The original Auth0 user ID (e.g., "google-oauth2_108922242653550022044")
 * @returns A hashed ID suitable for public URLs (e.g., "a1b2c3d4e5f6g7h8")
 */
export async function createPublicUserId(auth0UserId: string): Promise<string> {
  // Use Web Crypto API to create SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(auth0UserId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 16 characters for a manageable URL length
  return hashHex.substring(0, 16);
}

/**
 * Synchronous version using a simple hash function (for cases where async isn't ideal)
 * Note: Less cryptographically secure but consistent and sufficient for our use case
 */
export function createPublicUserIdSync(auth0UserId: string): string {
  let hash = 0;
  for (let i = 0; i < auth0UserId.length; i++) {
    const char = auth0UserId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string with consistent length
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return hashHex + auth0UserId.length.toString(16).padStart(2, '0'); // Add length for extra uniqueness
}

/**
 * Cache for storing auth0UserId -> publicUserId mappings
 * This helps avoid repeated hashing and enables reverse lookups
 * Now with localStorage persistence for better performance
 */
const userIdCache = new Map<string, string>();
const reverseUserIdCache = new Map<string, string>();

// Storage keys for persistence
const STORAGE_KEYS = {
  USER_ID_MAPPINGS: 'stream_user_id_mappings',
  REVERSE_MAPPINGS: 'stream_reverse_id_mappings',
};

/**
 * Load cached mappings from localStorage
 */
function loadCacheFromStorage(): void {
  try {
    // Load user ID mappings
    const storedMappings = localStorage.getItem(STORAGE_KEYS.USER_ID_MAPPINGS);
    if (storedMappings) {
      const mappings = JSON.parse(storedMappings);
      Object.entries(mappings).forEach(([auth0Id, publicId]) => {
        userIdCache.set(auth0Id, publicId as string);
      });
    }

    // Load reverse mappings
    const storedReverse = localStorage.getItem(STORAGE_KEYS.REVERSE_MAPPINGS);
    if (storedReverse) {
      const reverseMappings = JSON.parse(storedReverse);
      Object.entries(reverseMappings).forEach(([publicId, auth0Id]) => {
        reverseUserIdCache.set(publicId, auth0Id as string);
      });
    }
  } catch (error) {
    console.warn('Failed to load user ID mappings from storage:', error);
  }
}

/**
 * Save cached mappings to localStorage
 */
function saveCacheToStorage(): void {
  try {
    // Save user ID mappings
    const mappingsObj: Record<string, string> = {};
    userIdCache.forEach((publicId, auth0Id) => {
      mappingsObj[auth0Id] = publicId;
    });
    localStorage.setItem(STORAGE_KEYS.USER_ID_MAPPINGS, JSON.stringify(mappingsObj));

    // Save reverse mappings
    const reverseObj: Record<string, string> = {};
    reverseUserIdCache.forEach((auth0Id, publicId) => {
      reverseObj[publicId] = auth0Id;
    });
    localStorage.setItem(STORAGE_KEYS.REVERSE_MAPPINGS, JSON.stringify(reverseObj));
  } catch (error) {
    console.warn('Failed to save user ID mappings to storage:', error);
  }
}

// Initialize cache from storage on module load
loadCacheFromStorage();

/**
 * Get public user ID with caching
 */
export function getPublicUserId(auth0UserId: string): string {
  if (userIdCache.has(auth0UserId)) {
    return userIdCache.get(auth0UserId)!;
  }
  
  const publicId = createPublicUserIdSync(auth0UserId);
  userIdCache.set(auth0UserId, publicId);
  reverseUserIdCache.set(publicId, auth0UserId);
  
  return publicId;
}

/**
 * Get Auth0 user ID from public ID (reverse lookup)
 * Returns null if not found in cache
 */
export function getAuth0UserId(publicUserId: string): string | null {
  return reverseUserIdCache.get(publicUserId) || null;
}

/**
 * Populate the reverse cache with a known mapping
 * Useful when we get data from backend that includes both IDs
 */
export function cacheUserIdMapping(auth0UserId: string, publicUserId?: string): string {
  const publicId = publicUserId || getPublicUserId(auth0UserId);
  userIdCache.set(auth0UserId, publicId);
  reverseUserIdCache.set(publicId, auth0UserId);
  
  // Persist to localStorage for future sessions
  saveCacheToStorage();
  
  return publicId;
}

/**
 * Clear all cached user ID mappings (useful for logout)
 */
export function clearUserIdCache(): void {
  userIdCache.clear();
  reverseUserIdCache.clear();
  
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_ID_MAPPINGS);
    localStorage.removeItem(STORAGE_KEYS.REVERSE_MAPPINGS);
  } catch (error) {
    console.warn('Failed to clear user ID mappings from storage:', error);
  }
}

/**
 * Pre-populate cache with multiple mappings (useful for batch operations)
 */
export function cacheMultipleUserIdMappings(mappings: Array<{ auth0UserId: string; publicUserId?: string }>): void {
  mappings.forEach(({ auth0UserId, publicUserId }) => {
    const publicId = publicUserId || getPublicUserId(auth0UserId);
    userIdCache.set(auth0UserId, publicId);
    reverseUserIdCache.set(publicId, auth0UserId);
  });
  
  // Persist all mappings at once
  saveCacheToStorage();
}
