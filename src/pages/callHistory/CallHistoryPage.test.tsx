import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { CallHistoryPage } from "./CallHistoryPage";

describe("CallHistoryPage", () => {
  it("성공 시 그룹 헤더 + 카드를 렌더한다", async () => {
    renderWithQueryClient(<CallHistoryPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "통화 기록" })).toBeInTheDocument(),
    );
    // 적어도 한 그룹 헤더가 렌더돼야 한다 (시드가 매일 분포 갱신되므로 어떤 라벨이든)
    const groupHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(groupHeadings.length).toBeGreaterThan(0);
  });

  it("빈 응답이면 EmptyCallHistory 노출", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/calls", () =>
        HttpResponse.json({
          data: { items: [], hasNext: false },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);

    expect(await screen.findByText("아직 통화 기록이 없어요")).toBeInTheDocument();
  });

  it("파트너 카드 클릭 시 프로필 모달이 열리고 닫기 버튼으로 사라진다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("http://localhost:3000/api/v1/calls", () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                partner: { id: 7, name: "Sophie", profileImage: null },
                startedAt: new Date().toISOString(),
                durationSec: 312,
                analysisId: 100,
                analysisStatus: "COMPLETED",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        }),
      ),
      http.get("http://localhost:3000/api/v1/users/7", () =>
        HttpResponse.json({
          data: {
            id: 7,
            nickname: "Sophie",
            profileImage: null,
            level: "ADVANCED",
            mannerTemperature: 38.5,
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);

    const card = await screen.findByRole("button", { name: /Sophie/ });
    await user.click(card);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("38.5°C")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("프로필 모달의 [차단하기] 클릭 → 차단 확인 모달로 전환된다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("http://localhost:3000/api/v1/calls", () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                partner: { id: 7, name: "Sophie", profileImage: null },
                startedAt: new Date().toISOString(),
                durationSec: 60,
                analysisId: null,
                analysisStatus: "READY",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        }),
      ),
      http.get("http://localhost:3000/api/v1/users/7", () =>
        HttpResponse.json({
          data: {
            id: 7,
            nickname: "Sophie",
            profileImage: null,
            level: "ADVANCED",
            mannerTemperature: 38.5,
          },
          status: 200,
          message: "OK",
        }),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: /Sophie/ }));
    await user.click(await screen.findByRole("button", { name: "더보기" }));
    await user.click(screen.getByRole("menuitem", { name: "차단하기" }));

    expect(await screen.findByText("이 사용자를 차단할까요?")).toBeInTheDocument();
  });

  // 분석 티켓 차감 흐름용: READY 통화 1건 + quota 를 지정해 응답하는 핸들러.
  function seedAnalyzableCall(quota: {
    freeTicket: number;
    paidTicket: number;
  }) {
    server.use(
      http.get("http://localhost:3000/api/v1/calls", () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                partner: { id: 7, name: "Sophie", profileImage: null },
                startedAt: new Date().toISOString(),
                durationSec: 200,
                analysisId: null,
                analysisStatus: "READY",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        }),
      ),
      http.get("http://localhost:3000/api/v1/me/analysis-quota", () =>
        HttpResponse.json({
          data: { ...quota, nextResetAt: "2026-07-01T00:00:00" },
          status: 200,
          message: "OK",
        }),
      ),
    );
  }

  it("잔여 티켓이 있으면 '분석하기' 클릭 시 차감 확인 모달이 열린다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 1, paidTicket: 0 });

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: "분석하기" }));

    expect(await screen.findByText("이 통화를 분석할까요?")).toBeInTheDocument();
  });

  it("차감 확인 모달에서 '분석하기' 를 누르면 분석을 요청하고 카드가 '분석중' 으로 전환되며 모달이 닫힌다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 1, paidTicket: 0 });

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: "분석하기" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "분석하기" }));

    expect(
      await screen.findByRole("button", { name: "분석중" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("이 통화를 분석할까요?")).not.toBeInTheDocument();
  });

  it("차감 확인 모달에서 '취소' 를 누르면 요청 없이 모달만 닫힌다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 1, paidTicket: 0 });

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: "분석하기" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    await waitFor(() =>
      expect(screen.queryByText("이 통화를 분석할까요?")).not.toBeInTheDocument(),
    );
    // 요청을 보내지 않았으므로 카드는 여전히 '분석하기' 상태.
    expect(
      screen.getByRole("button", { name: "분석하기" }),
    ).toBeInTheDocument();
  });

  it("잔여 티켓이 0 이면 '분석하기' 클릭 시 요청 없이 소진 모달이 열린다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 0, paidTicket: 0 });

    renderWithQueryClient(<CallHistoryPage />);
    // quota 가 로드된 뒤(배지 노출) 클릭해야 0 판정이 적용된다.
    await screen.findByLabelText("분석 티켓 잔여");
    await user.click(screen.getByRole("button", { name: "분석하기" }));

    const exhausted = await screen.findByText("오늘 분석 티켓을 다 썼어요");
    expect(exhausted).toBeInTheDocument();
    expect(screen.queryByText("이 통화를 분석할까요?")).not.toBeInTheDocument();

    // '확인' 으로 소진 모달을 닫는다.
    await user.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() =>
      expect(
        screen.queryByText("오늘 분석 티켓을 다 썼어요"),
      ).not.toBeInTheDocument(),
    );
  });

  it("확인 후 서버가 403(소진) 을 주면 소진 모달로 떨어진다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 1, paidTicket: 0 });
    server.use(
      http.post("http://localhost:3000/api/v1/calls/1/analysis", () =>
        HttpResponse.json(
          { data: null, status: 403, message: "분석 가능 횟수를 모두 사용했습니다." },
          { status: 403 },
        ),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: "분석하기" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "분석하기" }));

    expect(
      await screen.findByText("오늘 분석 티켓을 다 썼어요"),
    ).toBeInTheDocument();
  });

  it("확인 후 서버가 400(녹음 만료) 을 주면 사유 안내 모달을 띄운다", async () => {
    const user = userEvent.setup();
    seedAnalyzableCall({ freeTicket: 1, paidTicket: 0 });
    server.use(
      http.post("http://localhost:3000/api/v1/calls/1/analysis", () =>
        HttpResponse.json(
          {
            data: null,
            status: 400,
            message: "녹음 보관 기간이 지나 분석할 수 없습니다.",
          },
          { status: 400 },
        ),
      ),
    );

    renderWithQueryClient(<CallHistoryPage />);
    await user.click(await screen.findByRole("button", { name: "분석하기" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "분석하기" }));

    expect(await screen.findByText("분석할 수 없어요")).toBeInTheDocument();
    expect(
      screen.getByText("녹음 보관 기간이 지나 분석할 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("에러 시 다시 시도 버튼 클릭하면 refetch 동작", async () => {
    let attempts = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/calls", () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 1,
                partner: { id: 1001, name: "Retry", profileImage: null },
                startedAt: new Date().toISOString(),
                durationSec: 60,
                analysisId: null,
                analysisStatus: "READY",
              },
            ],
            hasNext: false,
          },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<CallHistoryPage />);

    const retry = await screen.findByRole("button", { name: /다시 시도/ });
    await userEvent.click(retry);

    expect(await screen.findByText("Retry")).toBeInTheDocument();
  });
});
