import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { PhraseCard } from "./PhraseCard";

describe("PhraseCard", () => {
  it("expression 과 meaning 을 모두 표시한다", () => {
    renderWithQueryClient(
      <PhraseCard
        id={1}
        expression="I totally get what you mean."
        meaning="무슨 말인지 완전히 이해했어요."
      />,
    );

    expect(
      screen.getByText("I totally get what you mean."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("무슨 말인지 완전히 이해했어요."),
    ).toBeInTheDocument();
  });

  it("찜 해제(별표) 버튼을 보여준다", () => {
    renderWithQueryClient(<PhraseCard id={1} expression="x" meaning="y" />);

    expect(
      screen.getByRole("button", { name: "찜 해제" }),
    ).toBeInTheDocument();
  });
});
