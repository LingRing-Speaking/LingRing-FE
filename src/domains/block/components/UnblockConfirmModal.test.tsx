import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { UnblockConfirmModal } from "./UnblockConfirmModal";

const noop = () => undefined;
const TARGET = { id: 42, nickname: "Sophie" };

describe("UnblockConfirmModal", () => {
  it("열려있을 때 닉네임이 포함된 안내 메시지를 노출한다", () => {
    renderWithQueryClient(
      <UnblockConfirmModal target={TARGET} open onClose={noop} onCancel={noop} />,
    );

    expect(screen.getByText("Sophie님의 차단을 해제할까요?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "해제" })).toBeInTheDocument();
  });

  it("해제 성공 시 onClose 가 호출된다", async () => {
    const user = userEvent.setup();
    let closed = 0;

    renderWithQueryClient(
      <UnblockConfirmModal
        target={TARGET}
        open
        onClose={() => {
          closed += 1;
        }}
        onCancel={noop}
      />,
    );

    await user.click(screen.getByRole("button", { name: "해제" }));

    await waitFor(() => expect(closed).toBe(1));
  });

  it("해제 실패 시 에러 메시지를 노출한다", async () => {
    server.use(
      http.delete("http://localhost:3000/api/v1/blocks/:blockedUserId", () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderWithQueryClient(
      <UnblockConfirmModal target={TARGET} open onClose={noop} onCancel={noop} />,
    );

    await user.click(screen.getByRole("button", { name: "해제" }));

    await waitFor(() =>
      expect(
        screen.getByText("차단 해제에 실패했어요. 잠시 후 다시 시도해주세요."),
      ).toBeInTheDocument(),
    );
  });

  it("취소 버튼 클릭 시 onCancel 호출", async () => {
    const user = userEvent.setup();
    let cancelled = 0;

    renderWithQueryClient(
      <UnblockConfirmModal
        target={TARGET}
        open
        onClose={noop}
        onCancel={() => {
          cancelled += 1;
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(cancelled).toBe(1);
  });

  it("target 이 null 이면 렌더하지 않는다", () => {
    const { container } = renderWithQueryClient(
      <UnblockConfirmModal target={null} open onClose={noop} onCancel={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
