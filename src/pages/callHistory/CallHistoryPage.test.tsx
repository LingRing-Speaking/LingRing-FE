import { screen, waitFor } from "@testing-library/react";
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
                analysisStatus: null,
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
    await user.click(await screen.findByRole("button", { name: "차단하기" }));

    expect(await screen.findByText("이 사용자를 차단할까요?")).toBeInTheDocument();
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
                analysisStatus: null,
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
