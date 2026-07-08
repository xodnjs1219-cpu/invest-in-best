type BatchRunsPaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

/** 순수 Presenter — totalCount 기반 이전/다음/현재 페이지 표시(R-3). */
export function BatchRunsPagination({ page, pageSize, totalCount, onPageChange }: BatchRunsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
      <span className="text-sm text-gray-600">
        {page} / {totalPages} 페이지 (총 {totalCount.toLocaleString("ko-KR")}건)
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        다음
      </button>
    </div>
  );
}
