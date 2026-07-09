import { Button } from "@/components/ui";

type ProposalPaginationProps = {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
};

/** 순수 Presenter — page/hasMore 기반 이전/다음 페이지 이동. */
export function ProposalPagination({ page, hasMore, onPageChange }: ProposalPaginationProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </Button>
      <span className="text-sm text-fg-muted">{page} 페이지</span>
      <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
        다음
      </Button>
    </div>
  );
}
