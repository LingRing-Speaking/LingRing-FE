import { useEffect, useState } from "react";
import { useDemoSignIn } from "@/domains/auth/hooks/useDemoSignIn";

interface DemoLoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoLoginModal({ open, onClose }: DemoLoginModalProps) {
  const [token, setToken] = useState("");
  const demoSignIn = useDemoSignIn();

  useEffect(() => {
    if (!open) return;
    setToken("");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !demoSignIn.isLoading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, demoSignIn.isLoading, onClose]);

  if (!open) return null;

  const trimmedToken = token.trim();
  const canSubmit = trimmedToken.length > 0 && !demoSignIn.isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await demoSignIn.signIn(trimmedToken);
    // navigate 는 useDemoSignIn 내부에서 처리. 실패 시 모달 유지하고 failure 노출.
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-login-title"
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label="데모 로그인 닫기"
        onClick={onClose}
        disabled={demoSignIn.isLoading}
        className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
      />
      <div className="relative w-full max-w-[320px] rounded-[20px] bg-white p-6 shadow-ctrl">
        <h3
          id="demo-login-title"
          className="text-center text-[17px] font-bold leading-tight tracking-tight text-gray-900"
        >
          데모 로그인
        </h3>
        <p className="mt-2 text-center text-[13px] font-medium leading-relaxed tracking-tight text-gray-500">
          App Review 안내문에 적힌 토큰을 입력해주세요.
        </p>

        <div className="mt-4">
          <label htmlFor="demo-token-input" className="sr-only">
            데모 토큰
          </label>
          <input
            id="demo-token-input"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={demoSignIn.isLoading}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="review-token-..."
            className="w-full rounded-[12px] border border-gray-200 px-3.5 py-2.5 text-[14px] tabular-nums tracking-tight text-gray-900 outline-none focus:border-mint-500 disabled:bg-gray-50"
          />
          {demoSignIn.failure && (
            <p
              role="alert"
              className="mt-2 text-[12.5px] font-medium leading-relaxed tracking-tight text-coral-600"
            >
              {demoSignIn.failure.message}
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={demoSignIn.isLoading}
            className="flex-1 rounded-[14px] bg-gray-100 py-3.5 text-[15px] font-bold tracking-tight text-gray-800 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-[14px] bg-mint-500 py-3.5 text-[15px] font-bold tracking-tight text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {demoSignIn.isLoading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
