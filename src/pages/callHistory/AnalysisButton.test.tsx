import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisButton } from "./AnalysisButton";

describe("AnalysisButton", () => {
  describe("status=null (default)", () => {
    it("'분석하기' 텍스트가 보이고 활성 상태다", () => {
      render(<AnalysisButton status={null} onTriggerAnalysis={() => {}} />);
      const btn = screen.getByRole("button", { name: "분석하기" });
      expect(btn).toBeEnabled();
    });

    it("클릭하면 onTriggerAnalysis 가 호출된다", async () => {
      const onTrigger = vi.fn();
      render(<AnalysisButton status={null} onTriggerAnalysis={onTrigger} />);
      await userEvent.click(screen.getByRole("button", { name: "분석하기" }));
      expect(onTrigger).toHaveBeenCalledOnce();
    });
  });

  describe("status=IN_PROGRESS", () => {
    it("'분석중' 텍스트 + disabled + 스피너가 노출된다", () => {
      render(
        <AnalysisButton status="IN_PROGRESS" onTriggerAnalysis={() => {}} />,
      );
      const btn = screen.getByRole("button", { name: "분석중" });
      expect(btn).toBeDisabled();
      expect(
        screen.getByRole("status", { name: "분석 진행 중" }),
      ).toBeInTheDocument();
    });

    it("클릭해도 onTriggerAnalysis 가 호출되지 않는다", async () => {
      const onTrigger = vi.fn();
      render(
        <AnalysisButton status="IN_PROGRESS" onTriggerAnalysis={onTrigger} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석중" }));
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("status=COMPLETED", () => {
    it("'분석 보기' 텍스트가 보이고 활성 상태다", () => {
      render(
        <AnalysisButton status="COMPLETED" onTriggerAnalysis={() => {}} />,
      );
      const btn = screen.getByRole("button", { name: "분석 보기" });
      expect(btn).toBeEnabled();
    });

    // 다음 이슈에서 결과 페이지 라우팅을 연결할 때 onClick 동작이 추가된다.
    it("클릭해도 onTriggerAnalysis 가 호출되지 않는다", async () => {
      const onTrigger = vi.fn();
      render(
        <AnalysisButton status="COMPLETED" onTriggerAnalysis={onTrigger} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석 보기" }));
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });
});
