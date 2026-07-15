import { describe, expect, it } from "vitest";
import {
  acceptFriendRequest,
  fetchFriends,
  fetchReceivedCount,
  removeRelation,
  searchFriend,
  sendFriendRequest,
} from "./friendApi";

describe("friendApi", () => {
  it("fetchFriends(ACCEPTED) 는 친구 목록 items/hasNext 를 반환한다", async () => {
    const result = await fetchFriends({ status: "ACCEPTED", page: 0, size: 20 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      userId: expect.any(Number),
      status: "ACCEPTED",
    });
    expect(typeof result.hasNext).toBe("boolean");
  });

  it("fetchFriends(PENDING, RECEIVED) 는 받은 요청만 반환한다", async () => {
    const result = await fetchFriends({
      status: "PENDING",
      direction: "RECEIVED",
      page: 0,
      size: 20,
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.direction === "RECEIVED")).toBe(true);
  });

  it("fetchFriends(PENDING, SENT) 는 보낸 요청만 반환한다", async () => {
    const result = await fetchFriends({
      status: "PENDING",
      direction: "SENT",
      page: 0,
      size: 20,
    });

    expect(result.items.every((item) => item.direction === "SENT")).toBe(true);
  });

  it("fetchReceivedCount 는 받은 요청 개수(count)를 반환한다", async () => {
    const { count } = await fetchReceivedCount();

    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("searchFriend 는 관계 없는 유저를 relation NONE 으로 반환한다", async () => {
    const result = await searchFriend("지훈");

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ nickname: "지훈", relation: "NONE" });
  });

  it("searchFriend 는 이미 친구면 relation FRIEND 를 반환한다", async () => {
    const result = await searchFriend("지우");

    expect(result?.relation).toBe("FRIEND");
  });

  it("searchFriend 는 본인 검색 시 relation SELF 를 반환한다", async () => {
    const result = await searchFriend("lee-tiger-1234");

    expect(result?.relation).toBe("SELF");
  });

  it("searchFriend 는 일치가 없으면 null 을 반환한다", async () => {
    const result = await searchFriend("없는닉네임입니다");

    expect(result).toBeNull();
  });

  it("sendFriendRequest 는 관계 없는 유저에게 PENDING 을 반환한다", async () => {
    const result = await sendFriendRequest(8);

    expect(result).toEqual({ userId: 8, status: "PENDING" });
  });

  it("sendFriendRequest 는 상대가 이미 나에게 보냈으면 즉시 ACCEPTED 를 반환한다", async () => {
    const result = await sendFriendRequest(5);

    expect(result.status).toBe("ACCEPTED");
  });

  it("acceptFriendRequest 는 받은 요청을 ACCEPTED 로 만든다", async () => {
    const result = await acceptFriendRequest(6);

    expect(result).toEqual({ userId: 6, status: "ACCEPTED" });
  });

  it("removeRelation 은 관계가 없어도 멱등하게 resolve 된다", async () => {
    await expect(removeRelation(999)).resolves.toBeNull();
  });
});
