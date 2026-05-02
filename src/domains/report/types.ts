export type ReportReason = "INAPPROPRIATE_CONVERSATION" | "BAD_MANNERS" | "OTHER";

export type ReportInput = {
  reportedUserId: number;
  reason: ReportReason;
  description: string;
};
