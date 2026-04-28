import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CallHero } from "./CallHero";

describe("CallHero", () => {
  it("힌트 문구 두 줄과 통화 시작 버튼을 렌더한다", () => {
    render(
      <MemoryRouter>
        <CallHero />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("오늘은 누구와 만나게 될까요?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("버튼을 눌러 랜덤 매칭을 시작해요"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통화 시작하기" }),
    ).toBeInTheDocument();
  });

  it("통화 시작 버튼을 누르면 /matching 으로 이동한다", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CallHero />} />
          <Route path="/matching" element={<div>매칭 화면</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "통화 시작하기" }));

    expect(screen.getByText("매칭 화면")).toBeInTheDocument();
  });
});
