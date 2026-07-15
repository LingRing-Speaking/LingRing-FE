import { BookmarkStarButton } from "@/domains/userExpression/components/BookmarkStarButton";
import { useDeleteExpression } from "@/domains/userExpression/hooks/useDeleteExpression";

type Props = {
  id: number;
  expression: string;
  meaning: string;
};

export function PhraseCard({ id, expression, meaning }: Props) {
  const { remove, isPending } = useDeleteExpression();

  return (
    <li className="relative rounded-[18px] bg-white p-5 pr-14 shadow-card">
      <div className="absolute right-2 top-2">
        <BookmarkStarButton
          active={true}
          pending={isPending}
          onToggle={() => remove(id)}
        />
      </div>
      <p className="m-0 text-[17px] font-semibold leading-[1.55] tracking-[-0.01em] text-gray-900">
        {expression}
      </p>
      <p className="mt-2.5 text-sm font-medium leading-[1.55] tracking-[-0.01em] text-gray-600">
        {meaning}
      </p>
    </li>
  );
}
