import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookmarkStarButton } from "./BookmarkStarButton";

describe("BookmarkStarButton", () => {
  it("미찜 상태면 aria-pressed=false, 라벨은 '찜하기'", () => {
    render(<BookmarkStarButton active={false} pending={false} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "찜하기" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("찜 상태면 aria-pressed=true, 라벨은 '찜 해제'", () => {
    render(<BookmarkStarButton active={true} pending={false} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "찜 해제" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("클릭하면 onToggle 을 호출한다", async () => {
    const onToggle = vi.fn();
    render(<BookmarkStarButton active={false} pending={false} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("pending 이면 disabled 이고 클릭해도 onToggle 을 호출하지 않는다", async () => {
    const onToggle = vi.fn();
    render(<BookmarkStarButton active={false} pending={true} onToggle={onToggle} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("터치 시작이 부모로 전파되지 않는다(캐러셀 스와이프 격리)", () => {
    const onParentTouch = vi.fn();
    render(
      <div onTouchStart={onParentTouch}>
        <BookmarkStarButton active={false} pending={false} onToggle={vi.fn()} />
      </div>,
    );

    fireEvent.touchStart(screen.getByRole("button"));

    expect(onParentTouch).not.toHaveBeenCalled();
  });
});
