import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MyRecords } from "./MyRecords";

describe("MyRecords", () => {
  it("저장한 표현 개수를 N개 형식으로 표시한다", () => {
    render(
      <MemoryRouter>
        <MyRecords expressionCount={42} />
      </MemoryRouter>,
    );

    expect(screen.getByText("저장한 표현")).toBeInTheDocument();
    expect(screen.getByText("42개")).toBeInTheDocument();
  });

  it("저장한 표현 항목은 /expressions 로 이동하는 링크다", () => {
    render(
      <MemoryRouter>
        <MyRecords expressionCount={3} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /저장한 표현/ })).toHaveAttribute(
      "href",
      "/expressions",
    );
  });
});
