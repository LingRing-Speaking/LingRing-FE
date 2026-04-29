import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

async function startMockWorker() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_MSW !== "on") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

startMockWorker()
  .catch((error) => {
    console.error("[MSW] worker 시작 실패 — mock 없이 계속합니다", error);
  })
  .then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
