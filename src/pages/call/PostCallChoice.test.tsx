import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PostCallChoice } from "./PostCallChoice";

const noop = () => {};

describe("PostCallChoice", () => {
  it("timeout 종료면 '수고했어요' 카피를 보여준다", () => {
    render(<PostCallChoice reason="timeout" onAnalyze={noop} onTalkAgain={noop} />);
    expect(screen.getByText(/수고했어요/)).toBeInTheDocument();
  });

  it("self 종료면 '오늘 대화는 어땠나요' 카피를 보여준다", () => {
    render(<PostCallChoice reason="self" onAnalyze={noop} onTalkAgain={noop} />);
    expect(screen.getByText(/오늘 대화는 어땠나요/)).toBeInTheDocument();
  });

  it("peer 종료면 상대가 종료했음을 알린다", () => {
    render(<PostCallChoice reason="peer" onAnalyze={noop} onTalkAgain={noop} />);
    expect(screen.getByText("상대방이 통화를 종료했어요")).toBeInTheDocument();
  });

  it("두 선택지 버튼을 동등하게 보여준다", () => {
    render(<PostCallChoice reason="timeout" onAnalyze={noop} onTalkAgain={noop} />);
    expect(
      screen.getByRole("button", { name: "통화 내용 분석하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "한 번 더 대화하기" }),
    ).toBeInTheDocument();
  });

  it("'통화 내용 분석하기' 클릭 시 onAnalyze 를 호출한다", async () => {
    const onAnalyze = vi.fn();
    render(<PostCallChoice reason="timeout" onAnalyze={onAnalyze} onTalkAgain={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "통화 내용 분석하기" }));

    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it("'한 번 더 대화하기' 클릭 시 onTalkAgain 을 호출한다", async () => {
    const onTalkAgain = vi.fn();
    render(<PostCallChoice reason="timeout" onAnalyze={noop} onTalkAgain={onTalkAgain} />);

    await userEvent.click(screen.getByRole("button", { name: "한 번 더 대화하기" }));

    expect(onTalkAgain).toHaveBeenCalledOnce();
  });
});
