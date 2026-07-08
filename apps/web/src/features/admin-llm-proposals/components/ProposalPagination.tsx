type ProposalPaginationProps = {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
};

/** 순수 Presenter — page/hasMore 기반 이전/다음 페이지 이동. */
export function ProposalPagination({ page, hasMore, onPageChange }: ProposalPaginationProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        이전
      </button>
      <span className="text-sm text-gray-600">{page} 페이지</span>
      <button
        type="button"
        disabled={!hasMore}
        onClick={() => onPageChange(page + 1)}
        className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        다음
      </button>
    </div>
  );
}
