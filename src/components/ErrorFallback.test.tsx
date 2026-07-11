import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@sentry/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "./ErrorFallback";

describe("ErrorFallback", () => {
  it("안내 문구와 다시 시도 버튼을 보여준다", () => {
    render(<ErrorFallback resetError={() => {}} />);

    expect(screen.getByText("문제가 발생했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("다시 시도 버튼을 누르면 resetError 를 호출한다", async () => {
    const user = userEvent.setup();
    const resetError = vi.fn();
    render(<ErrorFallback resetError={resetError} />);

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(resetError).toHaveBeenCalledOnce();
  });
});

// main.tsx 와 동일한 방식의 통합 — 렌더 중 던지는 자식이 흰 화면 대신 fallback 을 띄운다.
describe("ErrorBoundary 통합", () => {
  beforeEach(() => {
    // React 가 렌더 에러를 console.error 로 중계한다 — 테스트 출력 오염 방지.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("렌더 에러가 나면 fallback 화면을 보여준다", () => {
    function ThrowingChild(): never {
      throw new Error("render crash");
    }

    render(
      <ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("문제가 발생했어요")).toBeInTheDocument();
  });
});
