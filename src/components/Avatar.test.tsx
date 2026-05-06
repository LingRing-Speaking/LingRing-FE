import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";
import { FALLBACK_GRADIENTS, gradientForName } from "./avatarPalette";

describe("Avatar", () => {
  it("src 가 있으면 이미지를 렌더하고 이니셜은 노출하지 않는다", () => {
    render(<Avatar src="https://cdn/x.png" name="Jenson" size="sm" alt="상대 프로필 이미지" />);
    expect(screen.getByAltText("상대 프로필 이미지")).toHaveAttribute(
      "src",
      "https://cdn/x.png",
    );
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });

  it("src 가 없으면 이름 첫 글자를 이니셜로 노출한다", () => {
    render(<Avatar src={null} name="민지" size="md" />);
    expect(screen.getByText("민")).toBeInTheDocument();
  });

  it("이름이 빈 문자열이면 '?' 로 폴백한다", () => {
    render(<Avatar src={null} name="" size="sm" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("gradientForName", () => {
  it("동일 이름은 항상 동일 그라데이션을 받는다", () => {
    expect(gradientForName("Jenson")).toBe(gradientForName("Jenson"));
    expect(gradientForName("민지")).toBe(gradientForName("민지"));
  });

  it("그라데이션은 항상 FALLBACK_GRADIENTS 안에서만 선택된다", () => {
    const samples = ["Jenson", "민지", "Sophie", "왕밤빵", "요아정킬러", "a", ""];
    for (const name of samples) {
      expect(FALLBACK_GRADIENTS).toContain(gradientForName(name));
    }
  });

  it("최소 2개 이상의 서로 다른 이름은 서로 다른 그라데이션으로 분포된다", () => {
    const names = ["Jenson", "Minji", "Sophie", "David", "Emma", "Daniel", "Hannah"];
    const gradients = new Set(names.map(gradientForName));
    expect(gradients.size).toBeGreaterThanOrEqual(2);
  });
});
