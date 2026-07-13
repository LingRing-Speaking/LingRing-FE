type Props = {
  /** 현재 찜 상태. true 면 별에 불이 들어온 채움 별. */
  active: boolean;
  /** 등록/해제 요청 진행 중. 연타 방지를 위해 disabled 처리. */
  pending: boolean;
  onToggle: () => void;
};

/**
 * 문장(표현) 찜 토글 별표 버튼. 세 소스(분석 mistake·오늘의 추천·아이스브레이커)가
 * 공유한다. 아이스브레이커 캐러셀 안에서도 쓰이므로, 버튼 터치가 스와이프/자동회전으로
 * 번지지 않도록 클릭·터치 전파를 차단한다.
 */
export function BookmarkStarButton({ active, pending, onToggle }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "찜 해제" : "찜하기"}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        active ? "text-yellow-400" : "text-gray-300 active:text-gray-400"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[22px] w-[22px]"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
