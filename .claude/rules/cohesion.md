---
paths:
  - "src/**/*.{ts,tsx}"
---

# 응집도 (Cohesion)

## 폼 검증은 요구사항에 따라 필드/폼 레벨을 선택하라

- **필드 레벨**: 필드끼리 독립적, 비동기 검증, 재사용 가능한 필드
- **폼 레벨**: 필드가 서로 의존, wizard 흐름, 통합 검증

### 필드 레벨 (필드별 validate)
```tsx
<input
  {...register("name", {
    validate: (v) => v.trim() === "" ? "이름을 입력하세요." : true,
  })}
/>
```

### 폼 레벨 (Zod 스키마 통합)
```tsx
const schema = z.object({
  name: z.string().min(1, "이름을 입력하세요."),
  email: z.string().email("유효한 이메일이 아닙니다."),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

## 디렉토리는 타입뿐 아니라 도메인 단위로도 묶어라

`components/hooks/utils` 타입별로만 나누지 말고 **도메인 단위로도 묶는다**. 전역 공용은 루트에, 도메인 특화는 `domains/` 아래에.

```
src/
├── components/   # 전역 공용
├── hooks/
├── utils/
└── domains/
    ├── user/
    │   ├── components/UserProfileCard.tsx
    │   └── hooks/useUser.ts
    ├── product/
    │   ├── components/ProductList.tsx
    │   └── hooks/useProducts.ts
    └── order/
        ├── components/OrderSummary.tsx
        └── hooks/useOrder.ts
```

## 상수·유틸은 사용처와 같은 파일에 둬라

한 곳에서만 쓰이는 상수·헬퍼는 공용 `constants.ts`·`utils.ts`가 아니라 **사용처와 같은 파일**에 둔다. 공용 파일에 넣으면 사용처를 추적하려 파일을 오가야 하고, 더 이상 쓰이지 않아도 지워지지 않은 채 남는다. 여러 호출처가 생기면 그때 공용 파일로 승격시킨다.

❌ 멀리 떨어져 있음
```typescript
// src/constants.ts
export const LIKE_ANIMATION_DELAY_MS = 300;

// src/components/LikeButton.tsx
import { LIKE_ANIMATION_DELAY_MS } from "@/constants";
await delay(LIKE_ANIMATION_DELAY_MS);
```

✅ 같은 파일
```typescript
// src/components/LikeButton.tsx
const ANIMATION_DELAY_MS = 300;

async function onLikeClick() {
  await postLike(url);
  await delay(ANIMATION_DELAY_MS);
  await refetchPostLike();
}
```
