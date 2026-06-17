interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "V";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function UserAvatar({ name, imageUrl, size = "md" }: UserAvatarProps) {
  return (
    <span className={`veyra-avatar veyra-avatar-${size}`} aria-label={name}>
      {imageUrl ? <img src={imageUrl} alt="" /> : getInitials(name)}
    </span>
  );
}
