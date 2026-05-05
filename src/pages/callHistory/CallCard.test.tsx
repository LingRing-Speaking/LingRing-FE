import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";

function renderWithRouter(item: CallHistoryItem) {
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<CallCard call={item} now={new Date(2026, 3, 29, 14, 0)} onPartnerClick={() => {}} />} />
        <Route path="/calls/:callId/analysis" element={<div>analysis-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseCall: CallHistoryItem = {
  id: 42,
  partner: { id: 1042, name: "Jenson", profileImage: null },
  startedAt: new Date(2026, 3, 29, 19, 30, 0).toISOString(),
  durationSec: 323,
  analyzed: false,
};

describe("CallCard", () => {
  it("partner 이름 첫 글자(이니셜)와 이름·메타 텍스트를 노출한다", () => {
    renderWithRouter(baseCall);
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("Jenson")).toBeInTheDocument();
    expect(screen.getByText(/오늘 오후 7:30/)).toBeInTheDocument();
  });

  it("partner.profileImage 가 있으면 이니셜 대신 이미지가 노출된다", () => {
    renderWithRouter({
      ...baseCall,
      partner: { ...baseCall.partner, profileImage: "https://cdn/x.png" },
    });
    expect(screen.getByAltText("상대 프로필 이미지")).toHaveAttribute(
      "src",
      "https://cdn/x.png",
    );
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });

  it("analyzed=false 일 때 '분석하기' 버튼이 보인다", () => {
    renderWithRouter({ ...baseCall, analyzed: false });
    expect(
      screen.getByRole("button", { name: /분석하기/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /분석 보기/ }),
    ).not.toBeInTheDocument();
  });

  it("analyzed=true 일 때 '분석 보기' 버튼이 보인다", () => {
    renderWithRouter({ ...baseCall, analyzed: true });
    expect(
      screen.getByRole("button", { name: /분석 보기/ }),
    ).toBeInTheDocument();
  });

  it("액션 버튼 클릭 시 /calls/:id/analysis 로 이동한다", async () => {
    renderWithRouter(baseCall);
    await userEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    expect(screen.getByText("analysis-page")).toBeInTheDocument();
  });
});
