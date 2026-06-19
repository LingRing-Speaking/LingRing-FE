import { httpGet } from "@/lib/http";
import type { Icebreaker } from "../types";

type IcebreakerListResponse = { items: Icebreaker[] };

export const fetchRandomIcebreakers = async (
  count = 5,
): Promise<Icebreaker[]> => {
  const params = new URLSearchParams({ count: String(count) });
  const res = await httpGet<IcebreakerListResponse>(
    `/icebreakers?${params.toString()}`,
  );
  return res.items;
};
