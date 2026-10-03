import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RejoinConfirmModal } from "./RejoinConfirmModal";

function renderModal(loading = false) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<RejoinConfirmModal loading={loading} onCancel={onCancel} onConfirm={onConfirm} />);
  return { onCancel, onConfirm };
}

describe("RejoinConfirmModal", () => {
  it("이전 기록이 복구되지 않는다고 안내한다", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "최근에 탈퇴한 계정이에요" })).toBeInTheDocument();
    expect(screen.getByText(/이전 기록은 복구되지 않고/)).toBeInTheDocument();
  });

  it("다시 가입하기를 누르면 onConfirm, 취소를 누르면 onCancel 을 호출한다", () => {
    const { onCancel, onConfirm } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "다시 가입하기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("가입 요청 중에는 버튼을 잠그고 Escape 로도 닫히지 않는다", () => {
    const { onCancel } = renderModal(true);

    expect(screen.getByRole("button", { name: "가입 중..." })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });
});
