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
          <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-gray-700">{getSearchErrorMessage(errorCode)}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          재시도
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <p>검색 결과가 없습니다.</p>
      </div>
    );
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
        <p className="px-3 pt-2 text-xs text-gray-500">
          더 정확한 결과를 원하시면 시장 필터를 활용해 보세요.
        </p>
      )}

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
    </div>
  );
}
