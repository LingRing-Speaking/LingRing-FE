import { httpDelete, httpPost } from "@/lib/http";
import type { BookmarkSource, UserExpression } from "../types";

export const createBookmark = (source: BookmarkSource) =>
  httpPost<UserExpression>("/expressions", source);

export const deleteExpression = (id: number) =>
  httpDelete<void>(`/expressions/${id}`);
