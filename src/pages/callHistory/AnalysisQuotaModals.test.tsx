import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AnalysisConfirmModal,
  AnalysisExhaustedModal,
  AnalysisUnavailableModal,
} from "./AnalysisQuotaModals";

describe("AnalysisConfirmModal", () => {
  it("open=false 면 아무것도 렌더하지 않는다", () => {
    render(
      <AnalysisConfirmModal open={false} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByText("이 통화를 분석할까요?")).not.toBeInTheDocument();
  });

  it("open 이면 제목·안내를 노출하되 잔여 티켓 수치는 표시하지 않는다", () => {
    render(<AnalysisConfirmModal open onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("이 통화를 분석할까요?")).toBeInTheDocument();
    expect(screen.getByText("티켓 1장이 사용돼요")).toBeInTheDocument();
    expect(screen.queryByText(/일반티켓/)).not.toBeInTheDocument();
    expect(screen.queryByText(/황금티켓/)).not.toBeInTheDocument();
  });

  it("'분석하기' 클릭 시 onConfirm, '취소' 클릭 시 onCancel 이 호출된다", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <AnalysisConfirmModal open onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape 키로 onCancel 이 호출된다", async () => {
    const onCancel = vi.fn();
    render(<AnalysisConfirmModal open onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape 외 다른 키는 onCancel 을 호출하지 않는다", async () => {
    const onCancel = vi.fn();
    render(<AnalysisConfirmModal open onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard("a");
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("AnalysisExhaustedModal", () => {
  it("open 이면 소진 안내를 노출하고 '확인' 클릭 시 onClose 가 호출된다", async () => {
    const onClose = vi.fn();
    render(<AnalysisExhaustedModal open onClose={onClose} />);
    expect(screen.getByText("오늘 분석 티켓을 다 썼어요")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("open=false 면 렌더하지 않는다", () => {
    render(<AnalysisExhaustedModal open={false} onClose={() => {}} />);
    expect(
      screen.queryByText("오늘 분석 티켓을 다 썼어요"),
    ).not.toBeInTheDocument();
  });
});

describe("AnalysisUnavailableModal", () => {
  it("open 이면 제목과 서버가 준 사유 메시지를 노출한다", () => {
    render(
      <AnalysisUnavailableModal
        open
        message="녹음 보관 기간이 지나 분석할 수 없습니다."
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("분석할 수 없어요")).toBeInTheDocument();
    expect(
      screen.getByText("녹음 보관 기간이 지나 분석할 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("'확인' 클릭 시 onClose 가 호출된다", async () => {
    const onClose = vi.fn();
    render(<AnalysisUnavailableModal open message="사유" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("open=false 면 렌더하지 않는다", () => {
    render(
      <AnalysisUnavailableModal open={false} message="사유" onClose={() => {}} />,
    );
    expect(screen.queryByText("분석할 수 없어요")).not.toBeInTheDocument();
  });
});
