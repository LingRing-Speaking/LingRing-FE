import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchRandomIcebreakers } from "../api/icebreakerApi";
import type { Icebreaker } from "../types";

const DEFAULT_COUNT = 5;

export function useRandomIcebreakers(
  count: number = DEFAULT_COUNT,
): UseQueryResult<Icebreaker[], Error> {
  return useQuery({
    queryKey: ["icebreakers", "random", count],
    queryFn: () => fetchRandomIcebreakers(count),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}
