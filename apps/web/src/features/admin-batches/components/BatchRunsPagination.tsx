import { Button } from "@/components/ui";

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
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </Button>
      <span className="text-sm text-fg-muted">
        {page} / {totalPages} 페이지 (총 {totalCount.toLocaleString("ko-KR")}건)
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}
