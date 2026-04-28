import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Icebreaker } from "@/domains/icebreaker/types";
import { IcebreakerRotator } from "./IcebreakerRotator";

const sentences: Icebreaker[] = [
  { id: 1, expression: "First en", meaning: "첫번째 한국어", createdAt: "" },
  { id: 2, expression: "Second en", meaning: "두번째 한국어", createdAt: "" },
];

describe("IcebreakerRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기에 첫 번째 문장(영어 + 한국어)을 보여준다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    expect(screen.getByText("First en")).toBeInTheDocument();
    expect(screen.getByText("첫번째 한국어")).toBeInTheDocument();
  });

  it("intervalMs + fadeMs 가 지나면 다음 문장으로 바뀐다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000 + 100);
    });

    expect(screen.getByText("Second en")).toBeInTheDocument();
    expect(screen.getByText("두번째 한국어")).toBeInTheDocument();
  });

  it("진행 도트는 sentences 길이만큼 렌더되고 현재 인덱스만 active 다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const dots = screen.getAllByTestId("rotator-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("data-active", "true");
    expect(dots[1]).toHaveAttribute("data-active", "false");
  });
});
