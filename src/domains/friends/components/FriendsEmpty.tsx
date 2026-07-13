type Props = {
  onSearch: () => void;
  hasPendingRequest: boolean;
};

// 친구 0명 빈 상태. 받은 요청이 있으면 "요청 수락"도 함께 유도한다.
export function FriendsEmpty({ onSearch, hasPendingRequest }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint-50 text-3xl">
        👋
      </div>
      <p className="mb-1.5 text-[16px] font-extrabold text-gray-900">아직 친구가 없어요</p>
      <p className="mb-5 text-[13px] leading-relaxed text-gray-400">
        {hasPendingRequest ? (
          <>
            받은 요청을 수락하거나
            <br />
            닉네임으로 새 친구를 찾아보세요
          </>
        ) : (
          <>
            닉네임으로 친구를 찾아
            <br />
            요청을 보내보세요
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onSearch}
        className="rounded-xl bg-mint-500 px-6 py-2.5 text-[14px] font-bold text-white active:bg-mint-600"
      >
        친구 찾기
      </button>
    </div>
  );
}
