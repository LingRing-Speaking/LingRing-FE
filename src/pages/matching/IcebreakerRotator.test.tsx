import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("왼쪽 스와이프(임계치 초과)는 다음 문장을 보여준다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(card, {
      changedTouches: [{ clientX: 120, clientY: 100 }],
    });

    expect(screen.getByText("Second en")).toBeInTheDocument();
  });

  it("오른쪽 스와이프(임계치 초과)는 이전 문장(랩어라운드)을 보여준다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    // index 0 → 오른쪽 스와이프 → 마지막 인덱스(=1)
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(card, {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });

    expect(screen.getByText("Second en")).toBeInTheDocument();
  });

  it("임계치 미달 스와이프는 문장을 바꾸지 않고 자동 회전을 재개한다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(card, {
      changedTouches: [{ clientX: 170, clientY: 100 }],
    });

    expect(screen.getByText("First en")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000 + 100);
    });
    expect(screen.getByText("Second en")).toBeInTheDocument();
  });

  it("수직 우세 제스처는 문장을 바꾸지 않는다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(card, {
      changedTouches: [{ clientX: 140, clientY: 220 }],
    });

    expect(screen.getByText("First en")).toBeInTheDocument();
  });

  it("touchStart 만 유지된 동안엔 자동 회전이 멈춘다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });

    act(() => {
      vi.advanceTimersByTime((1000 + 100) * 3);
    });

    expect(screen.getByText("First en")).toBeInTheDocument();
  });

  it("touchCancel 은 자동 회전을 재개시킨다", () => {
    render(
      <IcebreakerRotator
        sentences={sentences}
        intervalMs={1000}
        fadeMs={100}
      />,
    );

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchCancel(card);

    act(() => {
      vi.advanceTimersByTime(1000 + 100);
    });

    expect(screen.getByText("Second en")).toBeInTheDocument();
  });
});
