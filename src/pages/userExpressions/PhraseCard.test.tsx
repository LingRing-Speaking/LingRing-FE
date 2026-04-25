import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhraseCard } from "./PhraseCard";

describe("PhraseCard", () => {
  it("expression 과 meaning 을 모두 표시한다", () => {
    render(
      <PhraseCard
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
});
