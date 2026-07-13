import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Icebreaker } from "@/domains/icebreaker/types";
import { IcebreakerRotator } from "./IcebreakerRotator";

const sentences: Icebreaker[] = [
  { id: 1, expression: "First en", meaning: "첫번째 한국어", createdAt: "", bookmarkId: null },
  { id: 2, expression: "Second en", meaning: "두번째 한국어", createdAt: "", bookmarkId: null },
  { id: 3, expression: "Third en", meaning: "세번째 한국어", createdAt: "", bookmarkId: null },
];

const INTERVAL_MS = 1000;

const findCurrent = () => {
  const track = screen.getByTestId("rotator-track");
  const slot = track.querySelector('[data-slot="current"]') as HTMLElement;
  return slot;
};

const swipe = (
  card: HTMLElement,
  { fromX, toX, toY = 100 }: { fromX: number; toX: number; toY?: number },
) => {
  fireEvent.touchStart(card, { touches: [{ clientX: fromX, clientY: 100 }] });
  fireEvent.touchMove(card, { touches: [{ clientX: toX, clientY: toY }] });
  fireEvent.touchEnd(card, {
    changedTouches: [{ clientX: toX, clientY: toY }],
  });
};

const finishTransition = () => {
  const track = screen.getByTestId("rotator-track");
  fireEvent.transitionEnd(track, { propertyName: "transform" });
};

describe("IcebreakerRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기에 current 슬롯에 첫 번째 문장(영어 + 한국어)이 보인다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const current = findCurrent();
    expect(within(current).getByText("First en")).toBeInTheDocument();
    expect(within(current).getByText("첫번째 한국어")).toBeInTheDocument();
  });

  it("진행 도트는 sentences 길이만큼 렌더되고 현재 인덱스만 active 다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const dots = screen.getAllByTestId("rotator-dot");
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("data-active", "true");
    expect(dots[1]).toHaveAttribute("data-active", "false");
    expect(dots[2]).toHaveAttribute("data-active", "false");
  });

  it("intervalMs 후 슬라이드 트랜지션이 시작되고, 종료 시 다음 문장이 current 가 된다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    finishTransition();

    const current = findCurrent();
    expect(within(current).getByText("Second en")).toBeInTheDocument();
  });

  it("왼쪽 드래그(임계치 초과) 후 트랜지션 종료 → 다음 문장", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    swipe(card, { fromX: 200, toX: 80 }); // deltaX = -120 (임계치 80 초과)
    finishTransition();

    const current = findCurrent();
    expect(within(current).getByText("Second en")).toBeInTheDocument();
  });

  it("오른쪽 드래그(임계치 초과) 후 트랜지션 종료 → 이전 문장(랩어라운드)", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    swipe(card, { fromX: 100, toX: 220 }); // deltaX = +120
    finishTransition();

    const current = findCurrent();
    expect(within(current).getByText("Third en")).toBeInTheDocument();
  });

  it("임계치 미달 드래그는 트랙을 0 으로 스냅백하고 문장은 그대로", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    swipe(card, { fromX: 200, toX: 170 }); // deltaX = -30 (임계치 80 미달)
    finishTransition();

    const current = findCurrent();
    expect(within(current).getByText("First en")).toBeInTheDocument();
  });

  it("수직 우세 제스처는 문장을 바꾸지 않는다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    swipe(card, { fromX: 200, toX: 130, toY: 230 }); // |dy|=130 > |dx|=70
    finishTransition();

    const current = findCurrent();
    expect(within(current).getByText("First en")).toBeInTheDocument();
  });

  it("touchStart 만 유지된 동안엔 자동 회전이 멈춘다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });

    const current = findCurrent();
    expect(within(current).getByText("First en")).toBeInTheDocument();
  });

  it("touchCancel 후 자동 회전이 재개된다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchCancel(card);
    finishTransition(); // snap-back transition

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    finishTransition(); // auto-advance transition

    const current = findCurrent();
    expect(within(current).getByText("Second en")).toBeInTheDocument();
  });

  it("드래그 중 트랙 transform 이 손가락 이동만큼 따라온다", () => {
    render(<IcebreakerRotator sentences={sentences} intervalMs={INTERVAL_MS} />);

    const card = screen.getByTestId("rotator-card");
    fireEvent.touchStart(card, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchMove(card, {
      touches: [{ clientX: 150, clientY: 100 }],
    });

    const track = screen.getByTestId("rotator-track");
    expect(track.style.transform).toContain("-50px");
  });
});

describe("IcebreakerRotator 찜 별표", () => {
  const KEY = ["icebreakers", "random", 5];
  const real: Icebreaker[] = [
    { id: 1, expression: "First en", meaning: "첫번째", createdAt: "", bookmarkId: null },
    { id: 2, expression: "Second en", meaning: "두번째", createdAt: "", bookmarkId: null },
  ];
  const fallback: Icebreaker[] = [
    { id: -1, expression: "Fallback en", meaning: "폴백", createdAt: "", bookmarkId: null },
  ];

  function setup(list: Icebreaker[]) {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    qc.setQueryData(KEY, list);
    render(
      <QueryClientProvider client={qc}>
        <IcebreakerRotator
          sentences={list}
          intervalMs={100_000}
          bookmarkQueryKey={KEY}
        />
      </QueryClientProvider>,
    );
    return qc;
  }

  const currentSlot = () =>
    screen
      .getByTestId("rotator-track")
      .querySelector('[data-slot="current"]') as HTMLElement;

  it("current 슬롯의 실제 아이스브레이커에는 찜하기 별표가 있다", () => {
    setup(real);

    expect(
      within(currentSlot()).getByRole("button", { name: "찜하기" }),
    ).toBeInTheDocument();
  });

  it("폴백(id<0) 아이스브레이커에는 별표가 없다", () => {
    setup(fallback);

    expect(
      screen.queryByRole("button", { name: "찜하기" }),
    ).not.toBeInTheDocument();
  });

  it("별표를 누르면 낙관적으로 찜된다", async () => {
    const qc = setup(real);

    await userEvent.click(
      within(currentSlot()).getByRole("button", { name: "찜하기" }),
    );

    await waitFor(() => {
      const list = qc.getQueryData<Icebreaker[]>(KEY);
      expect(list?.[0].bookmarkId).not.toBeNull();
    });
  });
});
