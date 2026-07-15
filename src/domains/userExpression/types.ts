export type UserExpression = {
  id: number;
  userId: number;
  expression: string;
  meaning: string;
  createdAt: string;
};

export type UserExpressionList = {
  items: UserExpression[];
  hasNext: boolean;
};

/**
 * 찜(저장) 등록 요청 바디. 문장 출처별로 갈리는 discriminated union 이며, BE 가
 * 서버에서 소스를 조회해 expression/meaning 을 채운다(클라는 텍스트를 보내지 않는다).
 * 소스가 늘면 이 union 에 항목만 추가한다.
 */
export type BookmarkSource =
  | { source: "ANALYSIS_MISTAKE"; analysisId: number; mistakeId: number }
  | { source: "DAILY_EXPRESSION"; recommendedExpressionId: number }
  | { source: "ICEBREAKER"; icebreakerId: number };
