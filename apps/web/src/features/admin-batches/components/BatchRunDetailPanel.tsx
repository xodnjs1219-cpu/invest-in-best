import type { ReactNode } from "react";
import { Badge, Button, Card, Heading, NumericText } from "@/components/ui";
import type { BatchRunDetailDto } from "@/features/admin-batches/backend/schema";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_BADGE_TONES,
  BATCH_RUN_STATUS_LABELS,
  CARRIED_OVER_BADGE_LABEL,
  NO_ERROR_LOG_MESSAGE,
  RUN_NOT_FOUND_BACK_BUTTON_LABEL,
  RUN_NOT_FOUND_MESSAGE,
} from "@/features/admin-batches/constants";
import { formatKstDateTime, formatRunDuration } from "@/features/admin-batches/lib/run-display";

type BatchRunDetailPanelProps = {
  run: BatchRunDetailDto | null;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  onRetry: () => void;
  onClose: () => void;
  failuresSlot: ReactNode;
};

/**
 * 순수 Presenter — 배치 실행 상세 패널(Main 6). 실행 요약 + errorLog 본문(모노스페이스,
 * 세로 스크롤) + 실패 목록(failuresSlot)을 렌더한다. 404는 안내 후 닫기 유도(E8).
 */
export function BatchRunDetailPanel({
  run,
  isLoading,
  isError,
  isNotFound,
  onRetry,
  onClose,
  failuresSlot,
}: BatchRunDetailPanelProps) {
  if (isNotFound) {
    return (
      <Card as="aside" className="flex flex-col gap-3 p-4 text-center">
        <p className="text-sm text-danger">{RUN_NOT_FOUND_MESSAGE}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {RUN_NOT_FOUND_BACK_BUTTON_LABEL}
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card as="aside" className="p-4 text-center text-sm text-fg-muted">
        로딩 중...
      </Card>
    );
  }

  if (isError) {
    return (
      <Card as="aside" className="flex flex-col items-center gap-3 p-4 text-center">
        <p className="text-sm text-danger">실행 상세를 불러오지 못했습니다.</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </Card>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <Card as="aside" className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <Heading level={2}>{BATCH_JOB_TYPE_LABELS[run.jobType]}</Heading>
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={BATCH_RUN_STATUS_BADGE_TONES[run.status]}>
          {BATCH_RUN_STATUS_LABELS[run.status]}
        </Badge>
        {run.isCarriedOver && <Badge tone="warning">{CARRIED_OVER_BADGE_LABEL}</Badge>}
        {run.targetMarket && <span className="text-fg-muted">시장: {run.targetMarket}</span>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-muted">시작</dt>
        <NumericText as="dd">{formatKstDateTime(run.startedAt)}</NumericText>
        <dt className="text-fg-muted">종료</dt>
        <NumericText as="dd">{run.finishedAt ? formatKstDateTime(run.finishedAt) : "-"}</NumericText>
        {run.finishedAt && (
          <>
            <dt className="text-fg-muted">소요 시간</dt>
            <NumericText as="dd">{formatRunDuration(run.startedAt, run.finishedAt)}</NumericText>
          </>
        )}
        <dt className="text-fg-muted">처리 건수</dt>
        <NumericText as="dd">{run.processedCount.toLocaleString("ko-KR")}</NumericText>
        <dt className="text-fg-muted">실패 건수</dt>
        <NumericText as="dd">{run.failedCount.toLocaleString("ko-KR")}</NumericText>
      </dl>

      <div>
        <Heading level={3}>실행 요약 로그</Heading>
        {run.errorLog ? (
          <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius)] bg-surface-sunken p-2 font-mono text-xs">
            {run.errorLog}
          </pre>
        ) : (
          <p className="mt-1 text-sm text-fg-muted">{NO_ERROR_LOG_MESSAGE}</p>
        )}
      </div>

      <div>
        <Heading level={3}>종목 단위 실패 목록</Heading>
        <div className="mt-1">{failuresSlot}</div>
      </div>
    </Card>
  );
}
