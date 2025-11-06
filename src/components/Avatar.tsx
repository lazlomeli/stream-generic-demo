import { useState } from "react";
import "./Avatar.css";

interface AvatarProps {
  userId?: string;
  userName?: string;
  userImage?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}

const sizeClasses = {
  sm: "size-sm",
  md: "size-md", 
  lg: "size-lg",
  xl: "size-xl",
};

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

export function Avatar({
  userId,
  userName,
  userImage,
  size = "md",
  className = "",
  style = {},
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  // Use userId or userName as seed for consistent avatar generation
  const seed = userId || userName || "default";
  
  // Select a style deterministically based on the seed
  const getAvatarStyle = () => {
    const charCode = seed.charCodeAt(0);
    const styleIndex = charCode % avatarStyles.length;
    return avatarStyles[styleIndex];
  };

  const avatarStyle = getAvatarStyle();
  const fallbackUrl = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(seed)}`;
  
  // Use actual user image if available and not errored, otherwise use fallback
  const avatarUrl = (userImage && !imageError) ? userImage : fallbackUrl;

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div
      className={`avatar ${sizeClasses[size]} ${className}`}
      style={style}
      title={userName || userId || "..."}
    >
      <img 
        src={avatarUrl} 
        alt={userName || userId || "User avatar"} 
        className="avatar-image"
        onError={handleImageError}
      />
    </div>
  );
}
