// 통화 화면 상단에 표시되는 녹음 중 indicator.
// connected + callId 가 있을 때만 활성 (callId 가 없으면 BE 가 callId 노출 안 한 매칭 — 녹음 안 함).
export function RecordingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      role="status"
      aria-label="통화 녹음 중"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-600"
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-coral-500"
      />
      녹음 중
    </span>
  );
}
