import { render, screen } from "@testing-library/react";
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
