import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndConfirmSheet } from "./EndConfirmSheet";

describe("EndConfirmSheet", () => {
  it("open=true 면 dialog 가 활성 상태로 노출된다", () => {
    render(
      <EndConfirmSheet open={true} onKeep={vi.fn()} onEnd={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "통화를 종료할까요?",
    });
    expect(dialog).not.toHaveAttribute("aria-hidden", "true");
  });

  it("open=false 면 dialog 가 hidden 으로 마크된다", () => {
    render(
      <EndConfirmSheet open={false} onKeep={vi.fn()} onEnd={vi.fn()} />,
    );

    expect(
      screen.getByRole("dialog", { hidden: true }),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("'계속하기' 클릭 시 onKeep 이 호출된다", async () => {
    const user = userEvent.setup();
    const onKeep = vi.fn();
    render(
      <EndConfirmSheet open={true} onKeep={onKeep} onEnd={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "계속하기" }));
    expect(onKeep).toHaveBeenCalledOnce();
  });

  it("'종료하기' 클릭 시 onEnd 가 호출된다", async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    render(
      <EndConfirmSheet open={true} onKeep={vi.fn()} onEnd={onEnd} />,
    );

    await user.click(screen.getByRole("button", { name: "종료하기" }));
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
