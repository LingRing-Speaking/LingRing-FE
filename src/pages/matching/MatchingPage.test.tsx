import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../../../test/msw/server";
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

  it("API 가 실패해도 폴백 문장으로 회전이 유지된다", async () => {
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
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-hidden", "true"),
    );
  });

  it("'취소하기' 를 누르면 / 로 navigate 한다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/" element={<div>메인 화면</div>} />
      </Routes>,
      { initialEntries: ["/matching"] },
    );

    await user.click(screen.getByRole("button", { name: "매칭 취소" }));
    await user.click(screen.getByRole("button", { name: "취소하기" }));

    expect(await screen.findByText("메인 화면")).toBeInTheDocument();
  });
});
