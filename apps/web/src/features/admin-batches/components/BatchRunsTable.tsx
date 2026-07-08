import type { BatchRunSummaryDto } from "@/features/admin-batches/backend/schema";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_BADGE_CLASSES,
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
    return <p className="p-6 text-center text-sm text-gray-500">로딩 중...</p>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">{RUNS_LOAD_ERROR_MESSAGE}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {RUNS_RETRY_BUTTON_LABEL}
        </button>
      </div>
    );
  }

  if (runs.length === 0) {
    return <p className="p-6 text-center text-sm text-gray-500">{EMPTY_RUNS_MESSAGE}</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
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
              className={`cursor-pointer border-b hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}
            >
              <td className="p-2">{BATCH_JOB_TYPE_LABELS[run.jobType]}</td>
              <td className="p-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${BATCH_RUN_STATUS_BADGE_CLASSES[run.status]}`}
                >
                  {BATCH_RUN_STATUS_LABELS[run.status]}
                </span>
                {run.isCarriedOver && (
                  <span
                    title={CARRIED_OVER_TOOLTIP}
                    className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800"
                  >
                    {CARRIED_OVER_BADGE_LABEL}
                  </span>
                )}
                {run.hasErrorLog && (
                  <span className="ml-1 text-xs text-gray-400" title="실패 요약 로그 있음">
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
