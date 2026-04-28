import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw/server";

// aria-hidden 속성이 붙은 요소도 getByRole 로 조회할 수 있도록 설정.
// CancelConfirmSheet 등에서 시트가 닫힐 때 aria-hidden="true" 를 유지한 채
// waitFor 내부에서 role 로 요소를 찾아야 하는 테스트를 지원한다.
configure({ defaultHidden: true });

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

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
