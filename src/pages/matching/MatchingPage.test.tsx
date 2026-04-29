import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { MatchingPage } from "./MatchingPage";

describe("MatchingPage", () => {
  it("상단 타이틀 '매칭 중' 과 안내 문구를 보여준다", () => {
    renderWithQueryClient(<MatchingPage />);

    expect(screen.getByText("매칭 중")).toBeInTheDocument();
    expect(
      screen.getByText("대화할 사람을 찾고 있어요"),
    ).toBeInTheDocument();
  });

  it("API 응답 전이라도 폴백 문장을 카드에 보여준다", () => {
    renderWithQueryClient(<MatchingPage />);

    expect(
      screen.getByText("How's your week going so far?"),
    ).toBeInTheDocument();
  });

  it("API 가 실패해도 초기 폴백 문장이 즉시 표시된다", async () => {
    server.use(
      http.get("http://localhost:3000/icebreakers", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<MatchingPage />);

    expect(
      screen.getByText("How's your week going so far?"),
    ).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 취소 시트가 열린다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MatchingPage />);

    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(
      screen.getByRole("dialog", { name: "매칭을 취소할까요?" }),
    ).toBeInTheDocument();
  });

  it("'계속 기다리기'를 누르면 시트가 닫힌다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MatchingPage />);

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "계속 기다리기" }));

    await waitFor(() =>
      expect(dialog).toHaveAttribute("aria-hidden", "true"),
    );
  });

  it("마운트 시 매칭 큐 입장 POST 를 1회 송신한다", async () => {
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await waitFor(() => expect(postCount).toBe(1));
  });

  it("POST 가 실패하면 에러 메시지와 다시 시도 / 메인으로 버튼이 나온다", async () => {
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
    );

    renderWithQueryClient(<MatchingPage />);

    expect(
      await screen.findByText("매칭을 시작할 수 없어요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "메인으로" }),
    ).toBeInTheDocument();
  });

  it("'다시 시도' 클릭 시 POST 를 재호출한다", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        );
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await screen.findByText("매칭을 시작할 수 없어요.");
    expect(postCount).toBe(1);

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(postCount).toBe(2));
  });

  it("'다시 시도' 성공 후 언마운트 시 DELETE 를 1회 송신한다", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    let deleteCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        if (postCount === 1) {
          return HttpResponse.json(
            { data: null, status: 500, message: "fail" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
      http.delete("http://localhost:3000/users/1/matching", () => {
        deleteCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    const { unmount } = renderWithQueryClient(<MatchingPage />);

    await screen.findByText("매칭을 시작할 수 없어요.");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    // retry 성공 — 에러 메시지가 사라지고 정상 화면으로 복귀
    await waitFor(() =>
      expect(
        screen.queryByText("매칭을 시작할 수 없어요."),
      ).not.toBeInTheDocument(),
    );

    unmount();

    await waitFor(() => expect(deleteCount).toBe(1));
  });

  it("POST 성공 후 언마운트 시 DELETE 를 1회 송신한다", async () => {
    let postCount = 0;
    let deleteCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () => {
        postCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
      http.delete("http://localhost:3000/users/1/matching", () => {
        deleteCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    const { unmount } = renderWithQueryClient(<MatchingPage />);
    await waitFor(() => expect(postCount).toBe(1));

    unmount();

    await waitFor(() => expect(deleteCount).toBe(1));
  });

  it("POST 가 실패한 채 언마운트되면 DELETE 를 보내지 않는다", async () => {
    let deleteCount = 0;
    server.use(
      http.post("http://localhost:3000/users/1/matching", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "fail" },
          { status: 500 },
        ),
      ),
      http.delete("http://localhost:3000/users/1/matching", () => {
        deleteCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    const { unmount } = renderWithQueryClient(<MatchingPage />);
    await screen.findByText("매칭을 시작할 수 없어요.");

    unmount();

    // 잠깐 대기해서 혹시 비동기로 호출되는지 확인
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteCount).toBe(0);
  });

  it("POST 성공 후 GET 매칭 상태를 폴링한다", async () => {
    let getCount = 0;
    server.use(
      http.get("http://localhost:3000/users/1/matching", () => {
        getCount++;
        return HttpResponse.json({
          data: { status: "WAITING", partnerId: null, roomId: null },
          status: 200,
          message: "OK",
        });
      }),
    );

    renderWithQueryClient(<MatchingPage />);

    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(1));
  });

  it("'취소하기' 버튼 클릭 시 / 로 navigate 하고 DELETE 가 송신된다", async () => {
    const user = userEvent.setup();
    let deleteCount = 0;
    server.use(
      http.delete("http://localhost:3000/users/1/matching", () => {
        deleteCount++;
        return HttpResponse.json({
          data: null,
          status: 204,
          message: "NO_CONTENT",
        });
      }),
    );

    renderWithQueryClient(
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/" element={<div>메인 화면</div>} />
      </Routes>,
      { initialEntries: ["/matching"] },
    );

    // POST 성공 대기 (enteredRef 가 true 가 되어야 cleanup 이 DELETE 를 보냄)
    await waitFor(() => expect(screen.getByText("매칭 중")).toBeInTheDocument());
    // mutation 이 settled 될 시간 부여
    await new Promise((r) => setTimeout(r, 50));

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    await user.click(screen.getByRole("button", { name: "취소하기" }));

    expect(await screen.findByText("메인 화면")).toBeInTheDocument();
    await waitFor(() => expect(deleteCount).toBe(1));
  });
});
