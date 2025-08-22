/**
 * Utility functions for user management and Stream integration
 */

/**
 * Sanitizes a user ID to be compatible with Stream's requirements
 * - Removes special characters (keeps only alphanumeric, @, _, -)
 * - Truncates to 64 characters maximum
 * - Replaces invalid characters with underscores
 * 
 * @param userId - The raw user ID to sanitize
 * @returns Sanitized user ID safe for Stream API usage
 */
export const sanitizeUserId = (userId: string): string => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);
};

/**
 * Extracts and sanitizes a user ID from Auth0 user object
 * - Prioritizes user.sub (Auth0's unique identifier)
 * - Falls back to user.email if sub is not available
 * - Uses "anonymous" as final fallback
 * - Applies sanitization for Stream compatibility
 * 
 * @param user - Auth0 user object
 * @returns Sanitized user ID ready for Stream API usage
 */
export const getSanitizedUserId = (user: any): string => {
  const rawUserId = user?.sub || user?.email || "anonymous";
  return sanitizeUserId(rawUserId);
};

/**
 * Validates if a user ID meets Stream's requirements
 * - Checks if ID is not empty
 * - Verifies length is within limits (1-64 characters)
 * - Ensures only valid characters are present
 * 
 * @param userId - User ID to validate
 * @returns Object with validation result and any error messages
 */
export const validateUserId = (userId: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!userId || userId.trim().length === 0) {
    errors.push("User ID cannot be empty");
  }
  
  if (userId.length > 64) {
    errors.push("User ID cannot exceed 64 characters");
  }
  
  if (userId.length < 1) {
    errors.push("User ID must be at least 1 character");
  }
  
  // Check for invalid characters
  const invalidChars = userId.match(/[^a-zA-Z0-9@_-]/g);
  if (invalidChars) {
    errors.push(`User ID contains invalid characters: ${invalidChars.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
