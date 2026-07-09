import { Badge, Card, Heading } from "@/components/ui";
import type { BackfillProgressResponse } from "@/features/admin-batches/backend/schema";
import {
  BACKFILL_COMPLETED_LABEL,
  BACKFILL_LOAD_ERROR_MESSAGE,
  BACKFILL_NO_RUN_HISTORY_MESSAGE,
  BACKFILL_NOT_STARTED_LABEL,
  BATCH_RUN_STATUS_BADGE_TONES,
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
    return (
      <Card className="p-4 text-sm text-fg-muted">백필 진행 현황 로딩 중...</Card>
    );
  }

  if (isError || !progress) {
    return <Card className="p-4 text-sm text-danger">{BACKFILL_LOAD_ERROR_MESSAGE}</Card>;
  }

  const { percent, label } = formatBackfillProgress(progress.completedCheckpoints, progress.totalCheckpoints);
  const isNotStarted = progress.totalCheckpoints === 0;

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <Heading level={3}>전 종목 백필 진행 현황</Heading>
        {isNotStarted ? (
          <Badge tone="neutral">{BACKFILL_NOT_STARTED_LABEL}</Badge>
        ) : progress.isCompleted ? (
          <Badge tone="success">{BACKFILL_COMPLETED_LABEL}</Badge>
        ) : null}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-[var(--radius)] bg-surface-sunken">
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-fg-muted">
        {label} ({percent}%)
      </p>

      {progress.latestRun ? (
        <p className="text-xs text-fg-muted">
          최신 실행:{" "}
          <Badge tone={BATCH_RUN_STATUS_BADGE_TONES[progress.latestRun.status]}>
            {BATCH_RUN_STATUS_LABELS[progress.latestRun.status]}
          </Badge>{" "}
          {formatKstDateTime(progress.latestRun.startedAt)} ~{" "}
          {progress.latestRun.finishedAt ? formatKstDateTime(progress.latestRun.finishedAt) : "진행 중"}
        </p>
      ) : (
        <p className="text-xs text-fg-muted">{BACKFILL_NO_RUN_HISTORY_MESSAGE}</p>
      )}
    </Card>
  );
}
