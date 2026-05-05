import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { ProfileCard } from "./ProfileCard";

describe("ProfileCard", () => {
  it("profileImage 가 없으면 이름의 첫 글자를 이니셜로 보여준다", () => {
    renderWithQueryClient(
      <ProfileCard
        name="홍길동"
        profileImage={null}
        level="BEGINNER"
        mannerTemperature={36.5}
      />,
    );

    expect(screen.getByText("홍")).toBeInTheDocument();
  });

  it("profileImage 가 있으면 이니셜 대신 이미지를 보여준다", () => {
    renderWithQueryClient(
      <ProfileCard
        name="홍길동"
        profileImage="https://cdn/x.png"
        level="BEGINNER"
        mannerTemperature={36.5}
      />,
    );

    expect(screen.getByAltText("프로필 이미지")).toHaveAttribute(
      "src",
      "https://cdn/x.png",
    );
  });

  it("레벨 enum 을 영문 라벨로 변환해 보여준다", () => {
    const { rerender } = renderWithQueryClient(
      <ProfileCard name="A" profileImage={null} level="BEGINNER" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Beginner")).toBeInTheDocument();

    rerender(
      <ProfileCard name="A" profileImage={null} level="INTERMEDIATE" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Intermediate")).toBeInTheDocument();

    rerender(
      <ProfileCard name="A" profileImage={null} level="ADVANCED" mannerTemperature={36.5} />,
    );
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("매너온도를 표시하고 바 너비는 (온도 / 99 * 100)% 다", () => {
    renderWithQueryClient(
      <ProfileCard name="A" profileImage={null} level="BEGINNER" mannerTemperature={36.5} />,
    );

    expect(screen.getByText(/36\.5.*°C/)).toBeInTheDocument();
    const bar = screen.getByRole("img", { name: /매너온도 36\.5도/ });
    const fill = bar.querySelector<HTMLDivElement>('[data-testid="temp-fill"]');
    expect(fill?.style.width).toBe(`${(36.5 / 99) * 100}%`);
  });

  it("편집 버튼 클릭 시 프로필 편집 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProfileCard name="A" profileImage={null} level="BEGINNER" mannerTemperature={36.5} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "프로필 편집" }));
    expect(
      screen.getByRole("dialog", { name: "프로필 편집" }),
    ).toBeInTheDocument();
  });
});
