export function BreathingOrb() {
  return (
    <>
      <div
        aria-hidden="true"
        className="relative mt-3 mb-[22px] flex h-[220px] w-[220px] items-center justify-center"
      >
        <div className="pointer-events-none absolute -inset-[30px] rounded-full bg-[radial-gradient(circle,rgba(31,191,146,0.18)_0%,rgba(31,191,146,0)_70%)] animate-halo" />
        <div className="relative flex h-[160px] w-[160px] items-center justify-center rounded-full bg-gradient-to-br from-mint-300 via-mint-500 to-coral-500 text-white shadow-orb animate-breathe">
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 mb-3.5 flex gap-1.5">
        <span className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink" />
        <span
          className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="inline-block h-[7px] w-[7px] rounded-full bg-mint-400 animate-dot-blink"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </>
  );
}
