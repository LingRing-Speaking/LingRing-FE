import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyRecords } from "./MyRecords";

describe("MyRecords", () => {
  it("저장한 표현 개수를 N개 형식으로 표시한다", () => {
    render(<MyRecords savedExpressionCount={42} />);

    expect(screen.getByText("저장한 표현")).toBeInTheDocument();
    expect(screen.getByText("42개")).toBeInTheDocument();
  });
});
