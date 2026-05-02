import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { ReportModal } from "./ReportModal";

const noop = () => undefined;

describe("ReportModal", () => {
  it("열려있을 때 사유 라디오와 상세 입력을 노출한다", () => {
    renderWithQueryClient(
      <ReportModal
        partnerId={7}
        open
        onClose={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByText("신고 사유를 선택해주세요")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "부적절한 대화" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "비매너 태도" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "기타" })).toBeInTheDocument();
    expect(screen.getByLabelText("상세 내용")).toBeInTheDocument();
  });

  it("사유 미선택 또는 상세 5자 미만이면 제출 버튼이 비활성화", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ReportModal
        partnerId={7}
        open
        onClose={noop}
        onCancel={noop}
      />,
    );

    const submit = screen.getByRole("button", { name: "신고하고 차단" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "비매너 태도" }));
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("상세 내용"), "1234");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("상세 내용"), "5");
    expect(submit).toBeEnabled();
  });

  it("제출 성공 시 완료 화면으로 전환되고 확인 클릭하면 onClose 호출", async () => {
    const user = userEvent.setup();
    let onCloseCalled = 0;

    renderWithQueryClient(
      <ReportModal
        partnerId={7}
        open
        onClose={() => {
          onCloseCalled += 1;
        }}
        onCancel={noop}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "부적절한 대화" }));
    await user.type(screen.getByLabelText("상세 내용"), "욕설을 반복함");
    await user.click(screen.getByRole("button", { name: "신고하고 차단" }));

    await waitFor(() =>
      expect(screen.getByText("신고가 접수되었어요")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(onCloseCalled).toBe(1);
  });

  it("제출이 실패하면 에러 메시지를 노출한다", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/reports", () =>
        HttpResponse.json(
          { data: null, status: 500, message: "INTERNAL" },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithQueryClient(
      <ReportModal
        partnerId={7}
        open
        onClose={noop}
        onCancel={noop}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "기타" }));
    await user.type(screen.getByLabelText("상세 내용"), "기타 사유 상세");
    await user.click(screen.getByRole("button", { name: "신고하고 차단" }));

    await waitFor(() =>
      expect(
        screen.getByText("신고 접수에 실패했어요. 잠시 후 다시 시도해주세요."),
      ).toBeInTheDocument(),
    );
  });

  it("취소 버튼 클릭 시 onCancel 호출", async () => {
    const user = userEvent.setup();
    let cancelled = 0;

    renderWithQueryClient(
      <ReportModal
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
      <ReportModal
        partnerId={7}
        open={false}
        onClose={noop}
        onCancel={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
