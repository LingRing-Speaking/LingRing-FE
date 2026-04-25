type Props = { name: string };

export function Greeting({ name }: Props) {
  return (
    <div className="px-1 pb-5 pt-3">
      <h1 className="m-0 mb-1.5 text-[24px] font-extrabold leading-[1.3] tracking-[-0.02em] text-gray-900">
        안녕하세요,{" "}
        <em className="not-italic bg-gradient-to-r from-mint-500 to-coral-500 bg-clip-text text-transparent">
          {name}
        </em>
        님 👋
      </h1>
      <p className="m-0 text-[15px] font-medium leading-[1.5] text-gray-600">
        오늘도 영어 한 걸음 더 가볼까요?
      </p>
    </div>
  );
}
