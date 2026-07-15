import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MyRecords } from "./MyRecords";

const renderMyRecords = () =>
  render(
    <MemoryRouter>
      <MyRecords />
    </MemoryRouter>,
  );

describe("MyRecords", () => {
  it("저장한 표현 항목을 노출하고 '준비 중' 배지는 없다", () => {
    renderMyRecords();

    expect(screen.getByText("저장한 표현")).toBeInTheDocument();
    expect(screen.queryByText("준비 중")).not.toBeInTheDocument();
  });

  it("저장한 표현 항목은 /expressions 로 가는 링크다", () => {
    renderMyRecords();

    const link = screen.getByRole("link", { name: /저장한 표현/ });
    expect(link).toHaveAttribute("href", "/expressions");
  });
});
