import { gradientForName } from "./avatarPalette";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

type Props = {
  src: string | null | undefined;
  name: string;
  size: AvatarSize;
  alt?: string;
  className?: string;
  online?: boolean; // 지정하면 우하단에 온/오프라인 상태 점을 표시한다. 미지정이면 점 없음.
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

// 상태 점 크기 — 아바타 크기에 비례.
const STATUS_DOT_STYLES: Record<AvatarSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
  xl: "h-6 w-6",
};

export function Avatar({ src, name, size, alt = "프로필 이미지", className = "", online }: Props) {
  const styles = SIZE_STYLES[size];
  const initial = name?.[0] ?? "?";
  const gradient = gradientForName(name);

  const circle = (
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

  if (online === undefined) return circle;

  // overflow-hidden 원 안에 점을 넣으면 잘리므로 relative 래퍼로 감싸 원 밖 우하단에 얹는다.
  return (
    <div className="relative inline-flex">
      {circle}
      <span
        title={online ? "온라인" : "오프라인"}
        className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white ${STATUS_DOT_STYLES[size]} ${online ? "bg-mint-500" : "bg-gray-300"}`}
      />
    </div>
  );
}
