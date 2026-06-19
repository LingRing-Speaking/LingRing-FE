---
paths:
  - "src/**/*.{ts,tsx}"
---

# 가독성 (Readability)

## 매직 넘버는 이름 있는 상수로 대체하라

설명 없는 숫자는 의미 있는 상수로 대체.

```typescript
const ANIMATION_DELAY_MS = 300;

async function onLikeClick() {
  await postLike(url);
  await delay(ANIMATION_DELAY_MS); // 애니메이션 대기라는 의도가 드러남
  await refetchPostLike();
}
```

## 복잡한 로직은 전용 컴포넌트로 분리하라

복잡한 로직·상호작용은 전용 컴포넌트/HOC로 분리해서 책임을 나눈다.

```tsx
function App() {
  return (
    <AuthGuard>
      <LoginStartPage />
    </AuthGuard>
  );
}

function AuthGuard({ children }) {
  const status = useCheckLoginStatus();
  useEffect(() => {
    if (status === "LOGGED_IN") location.href = "/home";
  }, [status]);
  return status !== "LOGGED_IN" ? children : null;
}
```

## 조건에 따라 UI가 크게 다르면 컴포넌트를 분리하라

조건 분기에서 UI/로직이 크게 달라지면 각각을 별도 컴포넌트로.

```tsx
function SubmitButton() {
  const isViewer = useRole() === "viewer";
  return isViewer ? <ViewerSubmitButton /> : <AdminSubmitButton />;
}

function ViewerSubmitButton() {
  return <TextButton disabled>Submit</TextButton>;
}

function AdminSubmitButton() {
  useEffect(() => { showAnimation(); }, []);
  return <Button type="submit">Submit</Button>;
}
```

## 복잡한 삼항은 if/else나 IIFE로 풀어라

중첩·복잡 삼항 대신 읽기 쉬운 구조로.

```typescript
const status = (() => {
  if (ACondition && BCondition) return "BOTH";
  if (ACondition) return "A";
  if (BCondition) return "B";
  return "NONE";
})();
```

## 단순·국지적 로직은 인라인으로 두어라

위에서 아래로 읽히게 하여 시선 이동을 줄인다.

```tsx
function Page() {
  const user = useUser();
  const policy = {
    admin: { canInvite: true, canView: true },
    viewer: { canInvite: false, canView: true },
  }[user.role];
  if (!policy) return null;

  return (
    <div>
      <Button disabled={!policy.canInvite}>Invite</Button>
      <Button disabled={!policy.canView}>View</Button>
    </div>
  );
}
```

## 복잡한 조건은 이름 있는 변수로 뽑아라

조건식이 복잡·재사용·테스트 대상이면 이름 있는 변수로. 단순 1회성 조건은 그대로 둔다.

```typescript
const matchedProducts = products.filter((product) => {
  const isSameCategory = product.categories.some(
    (c) => c.id === targetCategory.id
  );
  const isPriceInRange = product.prices.some(
    (p) => p >= minPrice && p <= maxPrice
  );
  return isSameCategory && isPriceInRange;
});
```
