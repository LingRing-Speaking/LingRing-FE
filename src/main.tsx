import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeOtaUpdater } from "./lib/ota";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

async function startMockWorker() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_MSW !== "on") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

async function bootstrap() {
  try {
    await initializeOtaUpdater();
  } catch (error) {
    console.error("[ota] 초기화 실패 — 앱은 계속 진행합니다", error);
  }
  try {
    await startMockWorker();
  } catch (error) {
    console.error("[MSW] worker 시작 실패 — mock 없이 계속합니다", error);
  }
}

bootstrap().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
