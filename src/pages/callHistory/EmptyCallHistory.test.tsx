import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyCallHistory } from "./EmptyCallHistory";

describe("EmptyCallHistory", () => {
  it("빈 상태 제목과 부연 텍스트를 노출한다", () => {
    render(<EmptyCallHistory />);
    expect(screen.getByText("아직 통화 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("첫 통화를 시작해보세요.")).toBeInTheDocument();
  });
});
