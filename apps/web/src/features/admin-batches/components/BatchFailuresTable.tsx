import { Badge, Button } from "@/components/ui";
import type { BatchItemFailureDto } from "@/features/admin-batches/backend/schema";
import {
  FAILURES_LOAD_ERROR_MESSAGE,
  NO_FAILURES_MESSAGE,
  NON_SECURITY_FAILURE_PLACEHOLDER,
  RESOLVED_BADGE_LABEL,
  UNRESOLVED_BADGE_LABEL,
} from "@/features/admin-batches/constants";
import { formatKstDateTime } from "@/features/admin-batches/lib/run-display";

type BatchFailuresTableProps = {
  failures: BatchItemFailureDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onPageChange: (page: number) => void;
};

/**
 * 순수 Presenter — 실행별 종목 단위 실패 목록(Main 6, BR-8). 비종목 실패는 종목 칸을
 * placeholder로 표시하고, 해소 여부 배지로 재포함 성공을 구분한다.
 */
export function BatchFailuresTable({
  failures,
  totalCount,
  page,
  pageSize,
  isLoading,
  isError,
  onPageChange,
}: BatchFailuresTableProps) {
  if (isLoading) {
    return <p className="p-3 text-center text-sm text-fg-muted">로딩 중...</p>;
  }

  if (isError) {
    return <p className="p-3 text-center text-sm text-danger">{FAILURES_LOAD_ERROR_MESSAGE}</p>;
  }

  if (failures.length === 0) {
    return <p className="p-3 text-center text-sm text-fg-muted">{NO_FAILURES_MESSAGE}</p>;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-fg-muted">
            <th className="p-2">종목</th>
            <th className="p-2">시도 횟수</th>
            <th className="p-2">최종 오류</th>
            <th className="p-2">해소 여부</th>
            <th className="p-2">갱신 시각</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((failure) => (
            <tr key={failure.id} className="border-b border-border">
              <td className="p-2">
                {failure.security
                  ? `${failure.security.ticker} · ${failure.security.name} · ${failure.security.market}`
                  : NON_SECURITY_FAILURE_PLACEHOLDER}
              </td>
              <td className="p-2">{failure.attemptCount}</td>
              <td className="p-2">{failure.lastError ?? "-"}</td>
              <td className="p-2">
                <Badge tone={failure.isResolved ? "success" : "neutral"}>
                  {failure.isResolved ? RESOLVED_BADGE_LABEL : UNRESOLVED_BADGE_LABEL}
                </Badge>
              </td>
              <td className="p-2">{formatKstDateTime(failure.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-center gap-3 text-sm">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전
        </Button>
        <span className="text-fg-muted">
          {page} / {totalPages}
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
    </div>
  );
}
