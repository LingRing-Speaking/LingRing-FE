import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { renderWithQueryClient } from "../../../test/utils/renderWithQueryClient";
import { ProfileEditModal } from "./ProfileEditModal";

const PRESIGNED_URL = "http://localhost:3000/api/v1/me/profile/image/presigned-url";
const PROFILE_URL = "http://localhost:3000/api/v1/me/profile";
const S3_URL = "https://s3.example.com/profile-images/1/uuid";

const noop = () => undefined;

const okPresigned = () =>
  HttpResponse.json({
    data: { uploadUrl: S3_URL, key: "profile-images/1/uuid" },
    status: 200,
    message: "OK",
  });

const okPatch = (overrides?: Partial<{ nickname: string; profileImage: string | null }>) =>
  HttpResponse.json({
    data: {
      id: 1,
      nickname: overrides?.nickname ?? "old",
      profileImage: overrides?.profileImage ?? null,
    },
    status: 200,
    message: "OK",
  });

const renderModal = () =>
  renderWithQueryClient(
    <ProfileEditModal
      open
      currentNickname="old"
      currentProfileImage={null}
      onClose={noop}
    />,
  );

describe("ProfileEditModal", () => {
  it("open=false 면 아무것도 렌더하지 않는다", () => {
    const { container } = renderWithQueryClient(
      <ProfileEditModal
        open={false}
        currentNickname="old"
        currentProfileImage={null}
        onClose={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("초기 상태에서는 닉네임이 prefill 되고 [저장] 버튼은 disabled (변경분 없음)", () => {
    renderModal();

    expect(screen.getByLabelText("닉네임")).toHaveValue("old");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("닉네임을 1글자로 줄이면 인라인 에러 + [저장] disabled", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText("닉네임");
    await user.clear(input);
    await user.type(input, "x");

    expect(
      screen.getByText("닉네임은 2~15자여야 해요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("정상 닉네임으로 변경하면 [저장] 활성 → 클릭 시 PATCH 호출 후 onClose", async () => {
    const user = userEvent.setup();
    let patchedBody: unknown = null;
    let onCloseCalled = 0;
    server.use(
      http.patch(PROFILE_URL, async ({ request }) => {
        patchedBody = await request.json();
        return okPatch({ nickname: "new" });
      }),
    );

    renderWithQueryClient(
      <ProfileEditModal
        open
        currentNickname="old"
        currentProfileImage={null}
        onClose={() => {
          onCloseCalled += 1;
        }}
      />,
    );

    const input = screen.getByLabelText("닉네임");
    await user.clear(input);
    await user.type(input, "new");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onCloseCalled).toBe(1));
    expect(patchedBody).toEqual({ nickname: "new" });
  });

  it("30MB 초과 파일 선택 시 인라인 에러 + [저장] disabled", async () => {
    const user = userEvent.setup();
    renderModal();

    const big = new File([new Uint8Array(31 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    const fileInput = screen.getByLabelText("프로필 이미지 선택");
    await user.upload(fileInput, big);

    expect(
      screen.getByText("30MB 이하 이미지만 업로드할 수 있어요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("이미지가 아닌 파일 선택 시 인라인 에러", async () => {
    renderModal();

    const pdf = new File([new Uint8Array(10)], "doc.pdf", {
      type: "application/pdf",
    });
    // accept="image/*" 우회 — userEvent.upload 는 accept 와 jsdom 의 visibility 검사로
    // 매칭되지 않는 파일을 input 에 dispatch 하지 않으므로 fireEvent 로 직접 트리거.
    fireEvent.change(screen.getByLabelText("프로필 이미지 선택"), {
      target: { files: [pdf] },
    });

    expect(
      screen.getByText("이미지 파일만 선택해주세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("정상 이미지 선택 후 [저장] → presigned → PUT → PATCH → onClose", async () => {
    const user = userEvent.setup();
    let onCloseCalled = 0;
    let patchedBody: unknown = null;
    server.use(
      http.post(PRESIGNED_URL, okPresigned),
      http.put(S3_URL, () => new HttpResponse(null, { status: 200 })),
      http.patch(PROFILE_URL, async ({ request }) => {
        patchedBody = await request.json();
        return okPatch({ profileImage: "https://cdn/x" });
      }),
    );

    renderWithQueryClient(
      <ProfileEditModal
        open
        currentNickname="old"
        currentProfileImage={null}
        onClose={() => {
          onCloseCalled += 1;
        }}
      />,
    );

    const file = new File([new Uint8Array(8)], "p.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("프로필 이미지 선택"), file);
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onCloseCalled).toBe(1));
    expect(patchedBody).toEqual({ profileImageKey: "profile-images/1/uuid" });
  });

  it("409(NICKNAME_CONFLICT) 응답 시 안내 카피를 노출하고 모달은 유지된다", async () => {
    const user = userEvent.setup();
    let onCloseCalled = 0;
    server.use(
      http.patch(PROFILE_URL, () =>
        HttpResponse.json(
          { data: null, status: 409, message: "이미 사용 중인 닉네임입니다." },
          { status: 409 },
        ),
      ),
    );

    renderWithQueryClient(
      <ProfileEditModal
        open
        currentNickname="old"
        currentProfileImage={null}
        onClose={() => {
          onCloseCalled += 1;
        }}
      />,
    );

    const input = screen.getByLabelText("닉네임");
    await user.clear(input);
    await user.type(input, "taken");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(
        screen.getByText("이미 사용 중인 닉네임이에요."),
      ).toBeInTheDocument(),
    );
    expect(onCloseCalled).toBe(0);
  });

  it("취소 버튼 클릭 시 onClose 호출", async () => {
    const user = userEvent.setup();
    let onCloseCalled = 0;
    renderWithQueryClient(
      <ProfileEditModal
        open
        currentNickname="old"
        currentProfileImage={null}
        onClose={() => {
          onCloseCalled += 1;
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCloseCalled).toBe(1);
  });
});
