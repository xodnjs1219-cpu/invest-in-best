import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SecurityResultItem } from "@/features/securities/components/SecurityResultItem";
import { getSearchErrorMessage } from "@/features/securities/lib/search-error-message";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

type SearchResultsSectionProps = {
  items: SecuritySearchItem[];
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (ticker: string) => void;
  /** 오류 코드 — 문구 매핑용(선택). */
  errorCode?: string;
};

const LOADING_SKELETON_ROWS = 5;

/**
 * 검색 결과 목록 Presenter — 로딩/오류/빈 결과/목록+더보기 분기 렌더링.
 * 모든 분기는 props로부터 파생되며 자체 상태를 갖지 않는다.
 */
export function SearchResultsSection({
  items,
  isPending,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  onSelect,
  errorCode,
}: SearchResultsSectionProps) {
  if (isPending) {
    return (
      <div data-testid="search-results-loading" className="flex flex-col gap-2">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState message={getSearchErrorMessage(errorCode)} onRetry={onRetry} retryLabel="재시도" />
    );
  }

  if (items.length === 0) {
    return <EmptyState message="검색 결과가 없습니다." />;
  }

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <SecurityResultItem item={item} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      {items.length >= 20 && (
        <p className="px-3 pt-2 text-xs text-fg-muted">
          더 정확한 결과를 원하시면 시장 필터를 활용해 보세요.
        </p>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "불러오는 중..." : "더보기"}
          </Button>
        </div>
      )}
    </div>
  );
}
