
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  
  let time: Date;
  if (typeof timestamp === 'string') {
    if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
      time = new Date(timestamp + 'Z');
    } else {
      time = new Date(timestamp);
    }
  } else {
    time = timestamp;
  }
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 min ago' : `${diffInMinutes} min ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
  }

  return time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

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
