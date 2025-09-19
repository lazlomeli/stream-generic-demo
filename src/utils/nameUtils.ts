/**
 * Utility functions for handling participant names in video calls
 */

/**
 * Extract the first name from a full name
 * @param fullName - The full name string
 * @returns The first name only
 */
export const getFirstName = (fullName: string | undefined): string => {
  if (!fullName) return 'Unknown';
  
  // Split by space and take the first part
  const nameParts = fullName.trim().split(' ');
  return nameParts[0] || 'Unknown';
};

/**
 * Create a shortened version of a name for display in small spaces
 * @param fullName - The full name string
 * @param maxLength - Maximum character length (default: 10)
 * @returns Shortened name with ellipsis if needed
 */
export const getShortenedName = (fullName: string | undefined, maxLength: number = 10): string => {
  const firstName = getFirstName(fullName);
  
  if (firstName.length <= maxLength) {
    return firstName;
  }
  
  return firstName.substring(0, maxLength - 1) + '…';
};

/**
 * CSS-only approach to transform participant names to first name only
 * This uses CSS text manipulation instead of DOM manipulation to avoid React conflicts
 */
export const getFirstNameCSS = () => {
  // This function is kept for potential future use, but we'll use 
  // React-based solutions instead of DOM manipulation
  return '';
};
