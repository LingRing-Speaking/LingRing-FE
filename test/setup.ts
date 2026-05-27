import "@testing-library/jest-dom/vitest";
import "./utils/webrtcMocks";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";
import { resetMockState } from "@/mocks/handlers";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

// jsdom 은 MediaStream 글로벌을 제공하지 않음. native peerConnection path 가
// dummy MediaStream 을 onRemoteTrack 콜백 인자로 사용 (#84 방안 3).
class MediaStreamMock {
  active = true;
  id = "mock-stream";
  getTracks() {
    return [];
  }
  getAudioTracks() {
    return [];
  }
  getVideoTracks() {
    return [];
  }
  addTrack() {}
  removeTrack() {}
}
if (typeof globalThis.MediaStream === "undefined") {
  vi.stubGlobal("MediaStream", MediaStreamMock);
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetMockState();
});
afterAll(() => server.close());
