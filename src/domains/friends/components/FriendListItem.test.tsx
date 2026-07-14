import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FriendListItem } from "./FriendListItem";
import type { FriendItem } from "../types";

function makeFriend(overrides: Partial<FriendItem> = {}): FriendItem {
  return {
    userId: 2,
    nickname: "지우",
    profileImage: null,
    status: "ACCEPTED",
    direction: "SENT",
    requestedAt: "2026-07-01T10:00:00",
    online: false,
    ...overrides,
  };
}

describe("FriendListItem 온라인 표기", () => {
  it("online=true 인 친구는 온라인 상태 점을 표시한다", () => {
    render(
      <FriendListItem item={makeFriend({ online: true })} onSelect={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByTitle("온라인")).toBeInTheDocument();
  });

  it("online=false 인 친구는 오프라인 상태 점을 표시한다", () => {
    render(
      <FriendListItem item={makeFriend({ online: false })} onSelect={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByTitle("오프라인")).toBeInTheDocument();
  });

  it("탈퇴한 사용자는 상태 점을 표시하지 않는다", () => {
    render(
      <FriendListItem
        item={makeFriend({ nickname: null, online: true })}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByTitle("온라인")).not.toBeInTheDocument();
    expect(screen.queryByTitle("오프라인")).not.toBeInTheDocument();
  });
});

describe("FriendListItem 통화 걸기 (#213)", () => {
  it("online 친구는 통화 버튼을 보여주고, 누르면 onCall(userId) 을 호출한다", async () => {
    const user = userEvent.setup();
    const onCall = vi.fn();
    render(
      <FriendListItem
        item={makeFriend({ online: true })}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onCall={onCall}
      />,
    );

    await user.click(screen.getByRole("button", { name: "지우에게 통화 걸기" }));

    expect(onCall).toHaveBeenCalledWith(2);
  });

  it("통화 버튼을 눌러도 프로필 열기(onSelect)는 호출되지 않는다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FriendListItem
        item={makeFriend({ online: true })}
        onSelect={onSelect}
        onRemove={vi.fn()}
        onCall={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "지우에게 통화 걸기" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("오프라인 친구는 통화 버튼을 표시하지 않는다", () => {
    render(
      <FriendListItem
        item={makeFriend({ online: false })}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onCall={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /통화 걸기/ })).not.toBeInTheDocument();
  });

  it("탈퇴한 사용자는 통화 버튼을 표시하지 않는다", () => {
    render(
      <FriendListItem
        item={makeFriend({ nickname: null, online: true })}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onCall={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /통화 걸기/ })).not.toBeInTheDocument();
  });

  it("onCall 이 없으면 통화 버튼을 표시하지 않는다", () => {
    render(
      <FriendListItem item={makeFriend({ online: true })} onSelect={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /통화 걸기/ })).not.toBeInTheDocument();
  });
});
