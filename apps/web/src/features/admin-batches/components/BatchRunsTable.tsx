import { Badge, EmptyState, ErrorState } from "@/components/ui";
import type { BatchRunSummaryDto } from "@/features/admin-batches/backend/schema";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_BADGE_TONES,
  BATCH_RUN_STATUS_LABELS,
  CARRIED_OVER_BADGE_LABEL,
  CARRIED_OVER_TOOLTIP,
  EMPTY_RUNS_MESSAGE,
  RUNS_LOAD_ERROR_MESSAGE,
  RUNS_RETRY_BUTTON_LABEL,
} from "@/features/admin-batches/constants";
import { formatElapsed, formatKstDateTime } from "@/features/admin-batches/lib/run-display";

type BatchRunsTableProps = {
  runs: BatchRunSummaryDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  now: Date;
};

/**
 * 순수 Presenter — 배치 실행 이력 목록 테이블(Main 3~4). 로딩/오류/빈 상태 분기,
 * running 행은 경과 시간을 표시하고(E10), 재실행 버튼은 어떤 행에도 노출하지 않는다(E7).
 */
export function BatchRunsTable({
  runs,
  isLoading,
  isError,
  onRetry,
  selectedRunId,
  onSelect,
  now,
}: BatchRunsTableProps) {
  if (isLoading) {
    return <p className="p-6 text-center text-sm text-fg-muted">로딩 중...</p>;
  }

  if (isError) {
    return (
      <ErrorState
        message={RUNS_LOAD_ERROR_MESSAGE}
        onRetry={onRetry}
        retryLabel={RUNS_RETRY_BUTTON_LABEL}
      />
    );
  }

  if (runs.length === 0) {
    return <EmptyState message={EMPTY_RUNS_MESSAGE} />;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-fg-muted">
          <th className="p-2">작업 종류</th>
          <th className="p-2">상태</th>
          <th className="p-2">시작</th>
          <th className="p-2">종료(경과)</th>
          <th className="p-2">처리/실패</th>
          <th className="p-2">시장</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => {
          const isSelected = run.id === selectedRunId;
          const isRunning = run.status === "running";

          return (
            <tr
              key={run.id}
              onClick={() => onSelect(run.id)}
              className={`cursor-pointer border-b border-border hover:bg-surface-hover ${isSelected ? "bg-accent-soft" : ""}`}
            >
              <td className="p-2">{BATCH_JOB_TYPE_LABELS[run.jobType]}</td>
              <td className="p-2">
                <Badge tone={BATCH_RUN_STATUS_BADGE_TONES[run.status]}>
                  {BATCH_RUN_STATUS_LABELS[run.status]}
                </Badge>
                {run.isCarriedOver && (
                  <Badge tone="warning" title={CARRIED_OVER_TOOLTIP} className="ml-1">
                    {CARRIED_OVER_BADGE_LABEL}
                  </Badge>
                )}
                {run.hasErrorLog && (
                  <span className="ml-1 text-xs text-fg-subtle" title="실패 요약 로그 있음">
                    📄
                  </span>
                )}
              </td>
              <td className="p-2">{formatKstDateTime(run.startedAt)}</td>
              <td className="p-2">
                {isRunning ? formatElapsed(run.startedAt, now) : run.finishedAt ? formatKstDateTime(run.finishedAt) : "-"}
              </td>
              <td className="p-2">
                {run.processedCount.toLocaleString("ko-KR")} / {run.failedCount.toLocaleString("ko-KR")}
              </td>
              <td className="p-2">{run.targetMarket ?? "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
