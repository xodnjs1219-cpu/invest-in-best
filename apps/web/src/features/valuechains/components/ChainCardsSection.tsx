import { ChainCard } from "@/features/valuechains/components/ChainCard";
import type { ChainCard as ChainCardType } from "@/features/valuechains/lib/dto";

export type ChainCardsSectionProps = {
  title: string;
  items: ChainCardType[];
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** 빈 상태 안내 문구 분기 — 공식은 안내만, 내 체인은 생성 유도까지 포함(엣지 1·2). */
  emptyVariant: "official" | "mine";
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (chainId: string) => void;
};

const LOADING_SKELETON_CARDS = 4;

const EMPTY_MESSAGES: Record<ChainCardsSectionProps["emptyVariant"], string> = {
  official: "공식 체인이 아직 준비되지 않았습니다.",
  mine: "아직 만든 밸류체인이 없습니다. 새 밸류체인 만들기로 시작해 보세요.",
};

/**
 * 체인 카드 섹션 Presenter (UC-007 plan 모듈 D-5) — 공식/내 체인 공용(결정 B-2).
 * 로딩 스켈레톤 → 오류(안내+재시도) → 빈 상태(변형별 문구) → 카드 그리드+더보기 순으로 분기한다.
 * 모든 분기는 props로부터 파생되며 자체 상태를 갖지 않는다(state_management §7 계약).
 */
export function ChainCardsSection({
  title,
  items,
  isPending,
  isError,
  hasNextPage,
  isFetchingNextPage,
  emptyVariant,
  onLoadMore,
  onRetry,
  onSelect,
}: ChainCardsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

      {isPending ? (
        <div data-testid="chain-cards-loading" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: LOADING_SKELETON_CARDS }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-gray-700">목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            재시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p>{EMPTY_MESSAGES[emptyVariant]}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((card) => (
              <ChainCard key={card.id} card={card} onSelect={onSelect} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isFetchingNextPage ? "불러오는 중..." : "더보기"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
