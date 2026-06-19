import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CallHero } from "./CallHero";

describe("CallHero", () => {
  it("헤드라인 문구와 통화 시작 버튼을 렌더한다", () => {
    render(
      <MemoryRouter>
        <CallHero />
      </MemoryRouter>,
    );

    expect(
      screen.getByText((_, node) =>
        node?.textContent === "버튼을 눌러 학습 파트너와대화를 시작해봐요",
      ),
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
