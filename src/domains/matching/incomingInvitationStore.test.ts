import { beforeEach, describe, expect, it } from "vitest";
import { useIncomingInvitationStore } from "./incomingInvitationStore";

describe("useIncomingInvitationStore", () => {
  beforeEach(() => {
    useIncomingInvitationStore.setState({ invitation: null });
  });

  it("초기 invitation 은 null 이다", () => {
    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("setInvitation 으로 수신 초대를 저장한다", () => {
    const invitation = { inviterId: 2, deadline: "2026-07-15T00:00:30" };

    useIncomingInvitationStore.getState().setInvitation(invitation);

    expect(useIncomingInvitationStore.getState().invitation).toEqual(invitation);
  });

  it("setInvitation(null) 로 초대를 지운다", () => {
    useIncomingInvitationStore
      .getState()
      .setInvitation({ inviterId: 2, deadline: "2026-07-15T00:00:30" });

    useIncomingInvitationStore.getState().setInvitation(null);

    expect(useIncomingInvitationStore.getState().invitation).toBeNull();
  });

  it("같은 내용의 초대를 다시 넣으면 참조를 유지한다 (하트비트 5초 주기 재수신 시 재렌더 방지)", () => {
    useIncomingInvitationStore
      .getState()
      .setInvitation({ inviterId: 2, deadline: "2026-07-15T00:00:30" });
    const first = useIncomingInvitationStore.getState().invitation;

    useIncomingInvitationStore
      .getState()
      .setInvitation({ inviterId: 2, deadline: "2026-07-15T00:00:30" });

    expect(useIncomingInvitationStore.getState().invitation).toBe(first);
  });

  it("내용이 다른 초대가 오면 교체한다", () => {
    useIncomingInvitationStore
      .getState()
      .setInvitation({ inviterId: 2, deadline: "2026-07-15T00:00:30" });

    const next = { inviterId: 3, deadline: "2026-07-15T00:01:00" };
    useIncomingInvitationStore.getState().setInvitation(next);

    expect(useIncomingInvitationStore.getState().invitation).toEqual(next);
  });
});
