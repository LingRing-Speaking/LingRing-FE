import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallHero } from "./CallHero";

vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) },
}));

const kst = (time: string) => new Date(`2026-10-03T${time}+09:00`);

// 매칭은 KST 20:00~23:00 에만 열린다. Date 만 고정하고 타이머는 실제로 둬서 userEvent 가 멈추지 않게 한다.
function setNow(time: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(kst(time));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CallHero — 매칭 시간(20:00~23:00)", () => {
  beforeEach(() => setNow("21:00:00"));

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
    expect(screen.queryByText("지금은 친구와 전화해볼까요?")).not.toBeInTheDocument();
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

describe("CallHero — 매칭 시간 외", () => {
  beforeEach(() => setNow("19:00:00"));

  it("매칭 가능 시간을 안내하고 통화 시작 버튼을 비활성화한다", () => {
    render(
      <MemoryRouter>
        <CallHero />
      </MemoryRouter>,
    );

    expect(screen.getByText("매칭은 매일 저녁 8시~11시에 가능해요")).toBeInTheDocument();
    expect(screen.getByText("지금은 친구와 전화해볼까요?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "통화 시작하기" })).toBeDisabled();
  });

  it("버튼을 눌러도 /matching 으로 이동하지 않는다", async () => {
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

    expect(screen.queryByText("매칭 화면")).not.toBeInTheDocument();
  });
});
