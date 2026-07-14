import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import type { FriendRelation } from "@/domains/friends/types";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { PartnerProfileModal } from "./PartnerProfileModal";

const PARTNER_ID = 7;

function mockProfile(relation: FriendRelation) {
  server.use(
    http.get(`http://localhost:3000/api/v1/users/${PARTNER_ID}`, () =>
      HttpResponse.json({
        data: {
          id: PARTNER_ID,
          nickname: "Sophie",
          profileImage: null,
          level: "INTERMEDIATE",
          mannerTemperature: 36.5,
          relation,
        },
        status: 200,
        message: "OK",
      }),
    ),
  );
}

function renderModal(overrides?: { onReport?: () => void; onBlock?: () => void }) {
  return renderWithQueryClient(
    <PartnerProfileModal
      partnerId={PARTNER_ID}
      open
      onClose={vi.fn()}
      onReport={overrides?.onReport ?? vi.fn()}
      onBlock={overrides?.onBlock ?? vi.fn()}
    />,
  );
}

describe("PartnerProfileModal 친구 추가", () => {
  it("relation 이 NONE 이면 [친구 추가] 버튼이 노출되고 차단/신고는 본문에 없다", async () => {
    mockProfile("NONE");

    renderModal();

    expect(await screen.findByRole("button", { name: "친구 추가" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "차단하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "신고하기" })).not.toBeInTheDocument();
  });

  it("[친구 추가] 클릭 → POST /friends 후 버튼이 [요청됨]으로 갱신된다", async () => {
    const user = userEvent.setup();
    let relation: FriendRelation = "NONE";
    let requestedUserId: number | null = null;
    server.use(
      http.get(`http://localhost:3000/api/v1/users/${PARTNER_ID}`, () =>
        HttpResponse.json({
          data: {
            id: PARTNER_ID,
            nickname: "Sophie",
            profileImage: null,
            level: "INTERMEDIATE",
            mannerTemperature: 36.5,
            relation,
          },
          status: 200,
          message: "OK",
        }),
      ),
      http.post("http://localhost:3000/api/v1/friends", async ({ request }) => {
        const body = (await request.json()) as { targetUserId: number };
        requestedUserId = body.targetUserId;
        relation = "REQUEST_SENT";
        return HttpResponse.json(
          { data: { userId: PARTNER_ID, status: "PENDING" }, status: 201, message: "CREATED" },
          { status: 201 },
        );
      }),
    );

    renderModal();

    await user.click(await screen.findByRole("button", { name: "친구 추가" }));

    expect(await screen.findByText("요청됨")).toBeInTheDocument();
    expect(requestedUserId).toBe(PARTNER_ID);
  });

  it("relation 이 FRIEND 면 [✓ 친구] 라벨을 보여준다", async () => {
    mockProfile("FRIEND");

    renderModal();

    expect(await screen.findByText("✓ 친구")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "친구 추가" })).not.toBeInTheDocument();
  });

  it("relation 이 REQUEST_RECEIVED 면 [수락] 클릭 → PATCH 후 [✓ 친구]로 갱신된다", async () => {
    const user = userEvent.setup();
    let relation: FriendRelation = "REQUEST_RECEIVED";
    let patchedUserId: number | null = null;
    server.use(
      http.get(`http://localhost:3000/api/v1/users/${PARTNER_ID}`, () =>
        HttpResponse.json({
          data: {
            id: PARTNER_ID,
            nickname: "Sophie",
            profileImage: null,
            level: "INTERMEDIATE",
            mannerTemperature: 36.5,
            relation,
          },
          status: 200,
          message: "OK",
        }),
      ),
      http.patch("http://localhost:3000/api/v1/friends/:requesterId", ({ params }) => {
        patchedUserId = Number(params.requesterId);
        relation = "FRIEND";
        return HttpResponse.json({
          data: { userId: PARTNER_ID, status: "ACCEPTED" },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderModal();

    await user.click(await screen.findByRole("button", { name: "수락" }));

    expect(await screen.findByText("✓ 친구")).toBeInTheDocument();
    await waitFor(() => expect(patchedUserId).toBe(PARTNER_ID));
  });
});

describe("PartnerProfileModal 차단/신고 ⋯ 메뉴", () => {
  it("[더보기] 클릭 → 차단하기/신고하기 메뉴가 열린다", async () => {
    const user = userEvent.setup();
    mockProfile("NONE");

    renderModal();

    await user.click(await screen.findByRole("button", { name: "더보기" }));

    expect(screen.getByRole("menuitem", { name: "차단하기" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "신고하기" })).toBeInTheDocument();
  });

  it("[신고하기] 선택 → onReport 호출 후 메뉴가 닫힌다", async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    mockProfile("NONE");

    renderModal({ onReport });

    await user.click(await screen.findByRole("button", { name: "더보기" }));
    await user.click(screen.getByRole("menuitem", { name: "신고하기" }));

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "신고하기" })).not.toBeInTheDocument();
  });

  it("[차단하기] 선택 → onBlock 호출 후 메뉴가 닫힌다", async () => {
    const user = userEvent.setup();
    const onBlock = vi.fn();
    mockProfile("NONE");

    renderModal({ onBlock });

    await user.click(await screen.findByRole("button", { name: "더보기" }));
    await user.click(screen.getByRole("menuitem", { name: "차단하기" }));

    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "차단하기" })).not.toBeInTheDocument();
  });
});
