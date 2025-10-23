export const sanitizeUserId = (userId: string): string => {
  return userId.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);
};

export const getSanitizedUserId = (user: any): string => {
  const rawUserId = user?.sub || user?.email || "anonymous";
  return sanitizeUserId(rawUserId);
};

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
  
  const invalidChars = userId.match(/[^a-zA-Z0-9@_-]/g);
  if (invalidChars) {
    errors.push(`User ID contains invalid characters: ${invalidChars.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
