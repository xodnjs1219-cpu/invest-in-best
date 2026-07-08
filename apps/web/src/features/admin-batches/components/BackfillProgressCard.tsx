import type { BackfillProgressResponse } from "@/features/admin-batches/backend/schema";
import {
  BACKFILL_COMPLETED_LABEL,
  BACKFILL_LOAD_ERROR_MESSAGE,
  BACKFILL_NO_RUN_HISTORY_MESSAGE,
  BACKFILL_NOT_STARTED_LABEL,
  BATCH_RUN_STATUS_BADGE_CLASSES,
  BATCH_RUN_STATUS_LABELS,
} from "@/features/admin-batches/constants";
import { formatBackfillProgress, formatKstDateTime } from "@/features/admin-batches/lib/run-display";

type BackfillProgressCardProps = {
  progress: BackfillProgressResponse | null;
  isLoading: boolean;
  isError: boolean;
};

/**
 * 순수 Presenter — 백필(031) 진행 현황 카드(Main 8, BR-9). 체크포인트 0건이면
 * 미실행(0/0) 표기(E11), 오류는 카드 내부에만 표시해 목록 등 다른 영역에 영향을 주지 않는다.
 */
export function BackfillProgressCard({ progress, isLoading, isError }: BackfillProgressCardProps) {
  if (isLoading) {
    return <div className="rounded border p-4 text-sm text-gray-500">백필 진행 현황 로딩 중...</div>;
  }

  if (isError || !progress) {
    return <div className="rounded border p-4 text-sm text-red-600">{BACKFILL_LOAD_ERROR_MESSAGE}</div>;
  }

  const { percent, label } = formatBackfillProgress(progress.completedCheckpoints, progress.totalCheckpoints);
  const isNotStarted = progress.totalCheckpoints === 0;

  return (
    <div className="flex flex-col gap-2 rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">전 종목 백필 진행 현황</h2>
        {isNotStarted ? (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {BACKFILL_NOT_STARTED_LABEL}
          </span>
        ) : progress.isCompleted ? (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
            {BACKFILL_COMPLETED_LABEL}
          </span>
        ) : null}
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
        <div className="h-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-gray-600">
        {label} ({percent}%)
      </p>

      {progress.latestRun ? (
        <p className="text-xs text-gray-500">
          최신 실행:{" "}
          <span className={`rounded px-1.5 py-0.5 ${BATCH_RUN_STATUS_BADGE_CLASSES[progress.latestRun.status]}`}>
            {BATCH_RUN_STATUS_LABELS[progress.latestRun.status]}
          </span>{" "}
          {formatKstDateTime(progress.latestRun.startedAt)} ~{" "}
          {progress.latestRun.finishedAt ? formatKstDateTime(progress.latestRun.finishedAt) : "진행 중"}
        </p>
      ) : (
        <p className="text-xs text-gray-500">{BACKFILL_NO_RUN_HISTORY_MESSAGE}</p>
      )}
    </div>
  );
}
