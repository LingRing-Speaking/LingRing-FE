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
