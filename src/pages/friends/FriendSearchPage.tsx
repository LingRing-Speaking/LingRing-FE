import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { RelationActionButton } from "@/domains/friends/components/RelationActionButton";
import { SearchResultItem } from "@/domains/friends/components/SearchResultItem";
import { useAcceptFriendRequest } from "@/domains/friends/hooks/useAcceptFriendRequest";
import { useSearchFriend } from "@/domains/friends/hooks/useSearchFriend";
import { useSendFriendRequest } from "@/domains/friends/hooks/useSendFriendRequest";
import { UserProfileModal } from "@/domains/user/components/UserProfileModal";
import { PageShell } from "@/components/PageShell";

export function FriendSearchPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [openUserId, setOpenUserId] = useState<number | null>(null);

  const search = useSearchFriend(submitted);
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();

  const result = search.data ?? null;
  const actioning = sendMutation.isPending || acceptMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(input.trim());
  };

  const onAdd = () => {
    if (result) sendMutation.mutate(result.userId);
  };
  const onAccept = () => {
    if (result) acceptMutation.mutate(result.userId);
  };

  return (
    <PageShell>
      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-2 px-4 pb-2 pt-4">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 items-center gap-2 rounded-xl bg-gray-100 px-3 py-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="닉네임 검색"
              placeholder="닉네임 검색"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button type="submit" className="sr-only">
              검색
            </button>
          </form>
        </header>

        {submitted === "" && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-3 text-3xl">🔍</div>
            <p className="text-[13px] leading-relaxed text-gray-400">
              닉네임으로 친구를 찾아보세요
            </p>
          </div>
        )}

        {submitted !== "" && search.isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <div
              role="status"
              aria-label="로딩 중"
              className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-mint-500"
            />
          </div>
        )}

        {submitted !== "" && !search.isLoading && result && (
          <SearchResultItem
            result={result}
            onSelect={setOpenUserId}
            onAdd={onAdd}
            onAccept={onAccept}
            pending={actioning}
          />
        )}

        {submitted !== "" && !search.isLoading && !result && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-3 text-3xl">🔍</div>
            <p className="mb-1.5 text-[15px] font-bold text-gray-900">
              '{submitted}'님을 찾을 수 없어요
            </p>
            <p className="text-[13px] leading-relaxed text-gray-400">
              닉네임이 정확한지 확인해 주세요
            </p>
          </div>
        )}

        <UserProfileModal
          userId={openUserId}
          open={openUserId != null}
          onClose={() => setOpenUserId(null)}
          actions={() =>
            result ? (
              <div className="mt-2 flex justify-center py-2.5">
                <RelationActionButton
                  relation={result.relation}
                  onAdd={onAdd}
                  onAccept={onAccept}
                  pending={actioning}
                />
              </div>
            ) : null
          }
        />
      </main>
    </PageShell>
  );
}
