import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "./ProfileCard";

describe("ProfileCard", () => {
  it("이름의 첫 글자를 이니셜로 보여준다", () => {
    render(
      <ProfileCard name="홍길동" level="BEGINNER" mannerTemperature={36.5} />,
    );

    expect(screen.getByText("홍")).toBeInTheDocument();
  });

  it("레벨 enum 을 영문 라벨로 변환해 보여준다", () => {
    const { rerender } = render(
      <ProfileCard name="A" level="BEGINNER" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Beginner")).toBeInTheDocument();

    rerender(
      <ProfileCard name="A" level="INTERMEDIATE" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Intermediate")).toBeInTheDocument();

    rerender(
      <ProfileCard name="A" level="ADVANCED" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("매너온도를 표시하고 바 너비는 (온도 / 99 * 100)% 다", () => {
    render(
      <ProfileCard name="A" level="BEGINNER" mannerTemperature={36.5} />,
    );

    expect(screen.getByText(/36\.5.*°C/)).toBeInTheDocument();
    const bar = screen.getByRole("img", { name: /매너온도 36\.5도/ });
    const fill = bar.querySelector<HTMLDivElement>('[data-testid="temp-fill"]');
    expect(fill?.style.width).toBe(`${(36.5 / 99) * 100}%`);
  });

  it("편집 버튼은 disabled 다", () => {
    render(
      <ProfileCard name="A" level="BEGINNER" mannerTemperature={36.5} />,
    );

    expect(
      screen.getByRole("button", { name: "프로필 편집" }),
    ).toBeDisabled();
  });
});
