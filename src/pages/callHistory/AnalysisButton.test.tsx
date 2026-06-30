import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisButton } from "./AnalysisButton";

describe("AnalysisButton", () => {
  describe("analysisStatus=WAITING_RECORDINGS (녹음 업로드 중)", () => {
    it("'대기중' 버튼이 비활성으로 노출되고 스피너는 없다", () => {
      render(
        <AnalysisButton
          analysisStatus="WAITING_RECORDINGS"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "대기중" })).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("disabled 라 클릭해도 어떤 콜백도 호출되지 않는다", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="WAITING_RECORDINGS"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "대기중" }));
      expect(onTrigger).not.toHaveBeenCalled();
      expect(onView).not.toHaveBeenCalled();
    });
  });

  describe("analysisStatus=READY (분석 미요청)", () => {
    it("'분석하기' 버튼이 활성 상태로 노출된다", () => {
      render(
        <AnalysisButton
          analysisStatus="READY"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();
    });

    it("클릭하면 onTriggerAnalysis 만 호출된다", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="READY"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석하기" }));
      expect(onTrigger).toHaveBeenCalledOnce();
      expect(onView).not.toHaveBeenCalled();
    });
  });

  describe("analysisStatus=PROCESSING (분석 진행 중)", () => {
    it("'분석중' 버튼이 비활성으로 노출되고 스피너가 보인다", () => {
      render(
        <AnalysisButton
          analysisStatus="PROCESSING"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "분석중" })).toBeDisabled();
      expect(
        screen.getByRole("status", { name: "분석 진행 중" }),
      ).toBeInTheDocument();
    });

    it("disabled 라 클릭해도 어떤 콜백도 호출되지 않는다", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="PROCESSING"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석중" }));
      expect(onTrigger).not.toHaveBeenCalled();
      expect(onView).not.toHaveBeenCalled();
    });
  });

  describe("analysisStatus=COMPLETED (분석보기)", () => {
    it("'분석보기' 버튼이 활성 상태로 노출된다", () => {
      render(
        <AnalysisButton
          analysisStatus="COMPLETED"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "분석보기" })).toBeEnabled();
    });

    it("클릭하면 onViewResult 만 호출된다", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="COMPLETED"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "분석보기" }));
      expect(onView).toHaveBeenCalledOnce();
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("analysisStatus=FAILED (분석 실패)", () => {
    it("'재분석' 버튼이 활성 상태로 노출된다", () => {
      render(
        <AnalysisButton
          analysisStatus="FAILED"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "재분석" })).toBeEnabled();
    });

    it("클릭하면 onTriggerAnalysis 만 호출된다 (재시도)", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="FAILED"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "재분석" }));
      expect(onTrigger).toHaveBeenCalledOnce();
      expect(onView).not.toHaveBeenCalled();
    });
  });

  describe("analysisStatus=EXPIRED (녹음 보관 기간 만료)", () => {
    it("'기간 만료' 버튼이 비활성으로 노출된다", () => {
      render(
        <AnalysisButton
          analysisStatus="EXPIRED"
          onTriggerAnalysis={() => {}}
          onViewResult={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "기간 만료" })).toBeDisabled();
    });

    it("disabled 라 클릭해도 어떤 콜백도 호출되지 않는다", async () => {
      const onTrigger = vi.fn();
      const onView = vi.fn();
      render(
        <AnalysisButton
          analysisStatus="EXPIRED"
          onTriggerAnalysis={onTrigger}
          onViewResult={onView}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "기간 만료" }));
      expect(onTrigger).not.toHaveBeenCalled();
      expect(onView).not.toHaveBeenCalled();
    });
  });
});
