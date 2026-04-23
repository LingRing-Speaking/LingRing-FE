---
paths:
  - "src/**/*.{ts,tsx}"
---

# 예측 가능성 (Predictability)

## 비슷한 함수/훅의 반환 형태를 통일하라

호출자가 반환 모양을 예측할 수 있어야 한다.

### API 훅은 Query 객체를 그대로 반환
```typescript
function useUser(): UseQueryResult<UserType, Error> {
  return useQuery({ queryKey: ["user"], queryFn: fetchUser });
}

function useServerTime(): UseQueryResult<Date, Error> {
  return useQuery({ queryKey: ["serverTime"], queryFn: fetchServerTime });
}
```

### 검증 함수는 Discriminated Union으로 반환
```typescript
type ValidationResult = { ok: true } | { ok: false; reason: string };

function checkIsNameValid(name: string): ValidationResult {
  if (name.length === 0) return { ok: false, reason: "Name cannot be empty." };
  if (name.length >= 20) return { ok: false, reason: "Name too long." };
  return { ok: true };
}

const result = checkIsNameValid(name);
if (!result.ok) console.error(result.reason); // 타입 안전
```

## 함수 시그니처에 없는 부수 효과를 숨기지 마라

함수는 시그니처에 드러난 일만 한다. 로깅·분석 같은 부수 효과는 호출자가 명시한다.

```typescript
async function fetchBalance(): Promise<number> {
  return await http.get<number>("...");
}

async function handleUpdateClick() {
  const balance = await fetchBalance();
  logging.log("balance_fetched"); // 로깅은 호출자에서 명시
  await syncBalance(balance);
}
```

## 커스텀 래퍼에는 동작이 드러나는 이름을 붙여라

표준 라이브러리와 혼동될 수 있는 래퍼는 이름으로 동작을 노출시킨다.

```typescript
// httpService.ts
import { http as httpLibrary } from "@some-library/http";

export const httpService = {
  async getWithAuth(url: string) {
    // 이름만으로 인증 헤더가 붙는다는 것이 보임
    const token = await fetchToken();
    return httpLibrary.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
```
