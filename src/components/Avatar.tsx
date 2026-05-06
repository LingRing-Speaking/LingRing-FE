import { gradientForName } from "./avatarPalette";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

type Props = {
  src: string | null | undefined;
  name: string;
  size: AvatarSize;
  alt?: string;
  className?: string;
};

const SIZE_STYLES: Record<AvatarSize, { container: string; text: string }> = {
  sm: {
    container: "h-12 w-12",
    text: "text-[20px] font-bold leading-none tracking-tight",
  },
  md: {
    container: "h-16 w-16",
    text: "text-[26px] font-bold leading-none tracking-tight",
  },
  lg: {
    container: "h-20 w-20",
    text: "text-[32px] font-bold leading-none tracking-tight",
  },
  xl: {
    container: "h-40 w-40",
    text: "select-none text-[56px] font-bold tracking-[-0.02em]",
  },
};

export function Avatar({ src, name, size, alt = "프로필 이미지", className = "" }: Props) {
  const styles = SIZE_STYLES[size];
  const initial = name?.[0] ?? "?";
  const gradient = gradientForName(name);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-white ${styles.container} ${gradient} ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className={`text-white ${styles.text}`}>{initial}</span>
      )}
    </div>
  );
}
