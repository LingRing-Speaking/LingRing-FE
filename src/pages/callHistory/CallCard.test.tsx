import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CallHistoryItem } from "@/domains/callHistory/types";
import { CallCard } from "./CallCard";

function renderCard(item: CallHistoryItem, onPartnerClick: (id: number) => void = () => {}) {
  return render(
    <CallCard call={item} now={new Date(2026, 3, 29, 14, 0)} onPartnerClick={onPartnerClick} />,
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
    renderCard(baseCall);
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("Jenson")).toBeInTheDocument();
    expect(screen.getByText(/오늘 오후 7:30/)).toBeInTheDocument();
  });

  it("partner.profileImage 가 있으면 이니셜 대신 이미지가 노출된다", () => {
    renderCard({
      ...baseCall,
      partner: { ...baseCall.partner, profileImage: "https://cdn/x.png" },
    });
    expect(screen.getByAltText("상대 프로필 이미지")).toHaveAttribute(
      "src",
      "https://cdn/x.png",
    );
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });

  it("AI 분석 기능 미출시 — '분석 준비 중' disabled 버튼만 보인다 (analyzed 무관)", () => {
    renderCard({ ...baseCall, analyzed: false });
    const btn = screen.getByRole("button", { name: /분석 준비 중/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^분석하기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^분석 보기/ })).not.toBeInTheDocument();
  });

  it("analyzed=true 라도 동일하게 '분석 준비 중' disabled 버튼만 보인다", () => {
    renderCard({ ...baseCall, analyzed: true });
    const btn = screen.getByRole("button", { name: /분석 준비 중/ });
    expect(btn).toBeDisabled();
  });

  it("body(아바타·이름 영역) 클릭 시 onPartnerClick 이 호출된다", async () => {
    const onPartnerClick = vi.fn();
    renderCard(baseCall, onPartnerClick);
    await userEvent.click(screen.getByText("Jenson"));
    expect(onPartnerClick).toHaveBeenCalledWith(1042);
  });
});
