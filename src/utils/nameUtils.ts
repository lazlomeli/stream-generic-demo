
const getFirstName = (fullName: string | undefined): string => {
  if (!fullName) return 'Unknown';
  
  const nameParts = fullName.trim().split(' ');
  return nameParts[0] || 'Unknown';
};

const getShortenedName = (fullName: string | undefined, maxLength: number = 10): string => {
  const firstName = getFirstName(fullName);
  
  if (firstName.length <= maxLength) {
    return firstName;
  }
  
  return firstName.substring(0, maxLength - 1) + '…';
};

const getFirstNameCSS = () => {
  return '';
};

const sanitizeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, '');
}

export default {
  getFirstName,
  getShortenedName,
  getFirstNameCSS,
  sanitizeUserId,
}
