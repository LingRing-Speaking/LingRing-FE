---
paths:
  - "src/**/*.{ts,tsx}"
---

# 결합도 (Coupling)

## 확신 없는 중복은 추상화하지 말고 남겨둬라

중복이 진짜로 동일하고 앞으로도 같이 갈 확신이 없다면 중복을 허용하는 편이 결합도를 낮춘다. 쓰임이 나뉘기 시작하는 순간, 하나의 추상화에 갇힌 코드는 분기 플래그·옵션이 계속 늘어난다.

판단 기준: "이 로직이 정말로 모든 호출처에서 같은 방향으로 진화할 것인가?" 확신 없으면 분리해서 두 번 써라.

## 상태·훅은 단위별로 잘게 쪼개라

거대한 state·훅 하나에 모든 걸 담지 말고 단위별로 분리한다. 필요한 조각만 구독해 불필요한 재렌더도 줄인다.

```typescript
export function useCardIdQueryParam() {
  const [cardIdParam, setCardIdParam] = useQueryParam("cardId", NumberParam);

  const setCardId = useCallback(
    (newCardId: number | undefined) => {
      setCardIdParam(newCardId, "replaceIn");
    },
    [setCardIdParam]
  );

  return [cardIdParam ?? undefined, setCardId] as const;
}
// cardId만 필요한 컴포넌트는 dateRange 같은 다른 쿼리 파라미터에 얽히지 않는다.
```

## Props Drilling 대신 Composition을 써라

props를 중간 컴포넌트를 거쳐 여러 단계로 전달하는 대신 children으로 구성한다. 중간 래퍼가 줄면 결합도와 수정 비용이 모두 낮아진다.

```tsx
function ItemEditModal({ open, items, recommendedItems, onConfirm, onClose }) {
  const [keyword, setKeyword] = useState("");

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search items..."
        />
        <Button onClick={onClose}>Close</Button>
      </div>
      <ItemEditList
        keyword={keyword}
        items={items}
        recommendedItems={recommendedItems}
        onConfirm={onConfirm}
      />
    </Modal>
  );
}
// 중간 ItemEditBody 래퍼가 사라져 props 경로가 평탄해진다.
```
