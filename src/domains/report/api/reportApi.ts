import { httpPost } from "@/lib/http";
import type { ReportInput } from "../types";

const REPORTS_PATH = "/reports";

export const submitReport = (input: ReportInput): Promise<void> =>
  httpPost(REPORTS_PATH, input);
