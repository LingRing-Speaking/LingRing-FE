import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyRecords } from "./MyRecords";

describe("MyRecords", () => {
  it("저장한 표현 항목과 '준비 중' 배지를 노출한다", () => {
    render(<MyRecords />);

    expect(screen.getByText("저장한 표현")).toBeInTheDocument();
    expect(screen.getByText("준비 중")).toBeInTheDocument();
  });

  it("저장한 표현 항목이 출시 전이라 링크가 아니다 (진입 동선 차단)", () => {
    render(<MyRecords />);

    expect(screen.queryByRole("link", { name: /저장한 표현/ })).not.toBeInTheDocument();
  });
});
