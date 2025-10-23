import { useUser } from "../hooks/feeds/useUser";
import "./Avatar.css";

interface AvatarProps {
  userId?: string;
  userName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const avatarColors = [
  "color-blue",
  "color-green", 
  "color-purple",
  "color-pink",
  "color-indigo",
  "color-red",
  "color-yellow",
  "color-teal",
  "color-orange",
  "color-cyan",
  "color-emerald",
  "color-violet",
  "color-rose",
  "color-amber",
  "color-lime",
  "color-sky",
  "color-fuchsia",
  "color-slate",
  "color-gray",
  "color-zinc",
  "color-neutral",
  "color-stone",
];

const sizeClasses = {
  sm: "size-sm",
  md: "size-md", 
  lg: "size-lg",
  xl: "size-xl",
};

export function Avatar({
  userId,
  userName,
  size = "md",
  className = "",
}: AvatarProps) {
  const { getUserInitials } = useUser();

  // Generate initials from userName or userId
  const getInitials = () => {
    if (userName) {
      return getUserInitials(userName);
    }
    if (userId) {
      return userId.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Generate color based on initials
  const getColor = () => {
    const initials = getInitials();
    const charCode = initials.charCodeAt(0);
    const colorIndex = charCode % avatarColors.length;
    return avatarColors[colorIndex];
  };

  const initials = getInitials();
  const colorClass = getColor();

  return (
    <div
      className={`avatar ${sizeClasses[size]} ${colorClass} ${className}`}
      title={userName || userId || "..."}
    >
      {initials}
    </div>
  );
}
