import { Directory, Filesystem } from "@capacitor/filesystem";

// Android(web 경로) 녹음의 디스크 백업 저장소 (#187).
// 통화 중 MediaRecorder chunk 를 앱 전용 저장소(Directory.Data)에 이어 써서,
// 업로드 전에 앱이 죽어도 다음 시작 때 recoveryRun 이 재업로드할 수 있게 한다.
// 업로드 성공 시 파일을 즉시 삭제하므로 평상시 디스크 파일 수는 0개다.
const RECORDINGS_DIR = "recordings";

// 파일명 규칙: call-<callId>.<ext>. 확장자가 mimeType 을 복원하는 유일한 출처다.
const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
};
const MIME_BY_EXT: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
};
const PENDING_FILE_PATTERN = /^call-(\d+)\.(webm|mp4)$/;

function baseMime(mimeType: string): string {
  return mimeType.split(";")[0].trim();
}

function pathFor(callId: number, mimeType: string): string {
  const ext = EXT_BY_MIME[baseMime(mimeType)] ?? "webm";
  return `${RECORDINGS_DIR}/call-${callId}.${ext}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // 큰 chunk 에서 String.fromCharCode(...bytes) 의 인자 개수 제한을 피하려고 블록 단위로 변환.
  const BLOCK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += BLOCK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BLOCK));
  }
  return btoa(binary);
}

export interface AndroidRecordingStore {
  /** chunk 를 파일 끝에 이어 쓴다. 실패해도 throw 하지 않는다 — 녹음 본선(메모리)에 영향 없음. */
  append(chunk: Blob): Promise<void>;
  /** 백업 파일을 삭제한다 (업로드 성공 시). */
  remove(): Promise<void>;
}

export function createAndroidRecordingStore(
  callId: number,
  mimeType: string,
): AndroidRecordingStore {
  const path = pathFor(callId, mimeType);
  // 첫 append 전에 동일 callId 잔존 파일을 truncate (재시도 통화 대비) + 디렉토리 생성.
  // 이후 append 는 이 체인 뒤에 직렬로 매달려 순서가 보장된다.
  let chain: Promise<void> | null = null;

  const ensureOpened = (): Promise<void> => {
    if (!chain) {
      chain = Filesystem.writeFile({
        path,
        directory: Directory.Data,
        data: "",
        recursive: true,
      }).then(() => undefined);
    }
    return chain;
  };

  return {
    async append(chunk) {
      chain = ensureOpened()
        .then(async () => {
          const data = await blobToBase64(chunk);
          await Filesystem.appendFile({ path, directory: Directory.Data, data });
        })
        .catch((e) => {
          // 백업 실패는 삼킨다 — 메모리 경로가 본선이고, 백업만 없는 상태로 통화를 잇는다.
          console.warn("[androidRecordingStore] append failed", e);
        });
      return chain;
    },

    async remove() {
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
      } catch (e) {
        console.warn("[androidRecordingStore] delete failed", e);
      }
    },
  };
}

export interface PendingAndroidRecording {
  callId: number;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

/** recovery 용 — 업로드 못 끝낸 잔존 녹음 파일 목록. 디렉토리가 없으면 빈 배열. */
export async function listPendingAndroidRecordings(): Promise<PendingAndroidRecording[]> {
  let files;
  try {
    ({ files } = await Filesystem.readdir({
      path: RECORDINGS_DIR,
      directory: Directory.Data,
    }));
  } catch {
    return [];
  }

  const pending: PendingAndroidRecording[] = [];
  for (const file of files) {
    const match = PENDING_FILE_PATTERN.exec(file.name);
    if (!match) continue;
    pending.push({
      callId: Number(match[1]),
      path: `${RECORDINGS_DIR}/${file.name}`,
      mimeType: MIME_BY_EXT[match[2]],
      sizeBytes: file.size,
    });
  }
  return pending;
}

/** 잔존 파일을 업로드 가능한 Blob 으로 복원한다. */
export async function readPendingRecording(path: string, mimeType: string): Promise<Blob> {
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  const binary = atob(data as string);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function deletePendingRecording(path: string): Promise<void> {
  await Filesystem.deleteFile({ path, directory: Directory.Data });
}
