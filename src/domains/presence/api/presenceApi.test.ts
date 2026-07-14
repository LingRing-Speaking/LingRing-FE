import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHttpPost, mockHttpDelete } = vi.hoisted(() => ({
  mockHttpPost: vi.fn(),
  mockHttpDelete: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  httpPost: mockHttpPost,
  httpDelete: mockHttpDelete,
}));

import { goOffline, sendHeartbeat } from "./presenceApi";

describe("presenceApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendHeartbeat 는 POST /me/presence 를 호출한다", () => {
    sendHeartbeat();
    expect(mockHttpPost).toHaveBeenCalledWith("/me/presence");
  });

  it("goOffline 는 DELETE /me/presence 를 호출한다", () => {
    goOffline();
    expect(mockHttpDelete).toHaveBeenCalledWith("/me/presence");
  });
});
