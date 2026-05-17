import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../../test/utils/renderWithQueryClient";
import { BlockConfirmModal } from "./BlockConfirmModal";

const noop = () => undefined;

describe("BlockConfirmModal", () => {
  it("열려있을 때 안내 메시지와 취소/차단 버튼을 노출한다", () => {
    renderWithQueryClient(<BlockConfirmModal partnerId={7} open onClose={noop} onCancel={noop} />);

    expect(screen.getByText("이 사용자를 차단할까요?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "차단" })).toBeInTheDocument();
  });

  it("차단 성공 시 완료 카드로 전환되고 확인 클릭 시 onClose 호출", async () => {
    const user = userEvent.setup();
    let onCloseCalled = 0;

    renderWithQueryClient(
      <BlockConfirmModal
        partnerId={7}
        open
        onClose={() => {
          onCloseCalled += 1;
        }}
        onCancel={noop}
      />,
    );

    await user.click(screen.getByRole("button", { name: "차단" }));

    await waitFor(() => expect(screen.getByText("차단했어요")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(onCloseCalled).toBe(1);
  });

  it("차단 실패 시 에러 메시지를 노출한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/blocks", () =>
        HttpResponse.json({ data: null, status: 500, message: "INTERNAL" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderWithQueryClient(<BlockConfirmModal partnerId={7} open onClose={noop} onCancel={noop} />);

    await user.click(screen.getByRole("button", { name: "차단" }));

    await waitFor(() =>
      expect(screen.getByText("차단에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeInTheDocument(),
    );
  });

  it("취소 버튼 클릭 시 onCancel 호출", async () => {
    const user = userEvent.setup();
    let cancelled = 0;

    renderWithQueryClient(
      <BlockConfirmModal
        partnerId={7}
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

  it("open=false 면 아무것도 렌더하지 않는다", () => {
    const { container } = renderWithQueryClient(
      <BlockConfirmModal partnerId={7} open={false} onClose={noop} onCancel={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("partnerId 가 null 이면 렌더하지 않는다", () => {
    const { container } = renderWithQueryClient(
      <BlockConfirmModal partnerId={null} open onClose={noop} onCancel={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
