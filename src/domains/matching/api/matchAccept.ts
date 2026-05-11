import { httpPost } from "@/lib/http";

const ACCEPT_PATH = "/me/matching/accept";
const DECLINE_PATH = "/me/matching/decline";

export const acceptMatch = (): Promise<void> => httpPost(ACCEPT_PATH);

export const declineMatch = (): Promise<void> => httpPost(DECLINE_PATH);
