type Props = {
  expression: string;
  meaning: string;
};

export function PhraseCard({ expression, meaning }: Props) {
  return (
    <li className="rounded-[18px] bg-white p-5 shadow-card">
      <p className="m-0 text-[17px] font-semibold leading-[1.55] tracking-[-0.01em] text-gray-900">
        {expression}
      </p>
      <p className="mt-2.5 text-sm font-medium leading-[1.55] tracking-[-0.01em] text-gray-600">
        {meaning}
      </p>
    </li>
  );
}
