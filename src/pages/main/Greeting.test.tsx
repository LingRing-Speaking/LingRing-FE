import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Greeting } from "./Greeting";

describe("Greeting", () => {
  it("이름과 인삿말, 서브 카피를 노출한다", () => {
    render(<Greeting name="Lee" />);

    expect(screen.getByText("Lee")).toBeInTheDocument();
    expect(screen.getByText(/안녕하세요/)).toBeInTheDocument();
    expect(
      screen.getByText("오늘도 영어 한 걸음 더 가볼까요?"),
    ).toBeInTheDocument();
  });
});
