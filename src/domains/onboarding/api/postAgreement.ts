import { httpPost } from "@/lib/http";
import type { User } from "@/domains/auth/types";

export interface AgreementInput {
  termsVersion: string;
  agreedItems: AgreementItem[];
}

export type AgreementItem = "terms" | "privacy" | "over14";

interface AgreementResponse {
  user: User;
}

export function postAgreement(input: AgreementInput): Promise<AgreementResponse> {
  return httpPost<AgreementResponse>("/me/agreements", input);
}
