/**
 * Formats a timestamp into human-readable relative time
 * @param timestamp - ISO timestamp string or Date object
 * @returns Human-readable time like "Just now", "2 min ago", "3 hours ago"
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  
  // Handle Stream timestamps that come without timezone info (assume UTC)
  let time: Date;
  if (typeof timestamp === 'string') {
    // If timestamp doesn't end with 'Z' or have timezone info, assume it's UTC
    if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
      // Add 'Z' to treat as UTC
      time = new Date(timestamp + 'Z');
    } else {
      time = new Date(timestamp);
    }
  } else {
    time = timestamp;
  }
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  // Just now (less than 1 minute)
  if (diffInSeconds < 60) {
    return 'Just now';
  }

  // Minutes ago
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 min ago' : `${diffInMinutes} min ago`;
  }

  // Hours ago
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  // Days ago
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  // Weeks ago
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
  }

  // More than a month - show actual date
  return time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Formats a timestamp into a full readable date/time
 * @param timestamp - ISO timestamp string or Date object
 * @returns Full date like "Aug 22, 2025 at 12:15 PM"
 */
export function formatFullDateTime(timestamp: string | Date): string {
  const time = new Date(timestamp);
  return time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
