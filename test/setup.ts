import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/mocks/server";

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
