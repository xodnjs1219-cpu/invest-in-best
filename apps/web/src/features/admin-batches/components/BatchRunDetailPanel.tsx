import type { ReactNode } from "react";
import type { BatchRunDetailDto } from "@/features/admin-batches/backend/schema";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_BADGE_CLASSES,
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
      <aside className="flex flex-col gap-3 rounded border p-4 text-center">
        <p className="text-sm text-red-600">{RUN_NOT_FOUND_MESSAGE}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {RUN_NOT_FOUND_BACK_BUTTON_LABEL}
        </button>
      </aside>
    );
  }

  if (isLoading) {
    return <aside className="rounded border p-4 text-center text-sm text-gray-500">로딩 중...</aside>;
  }

  if (isError) {
    return (
      <aside className="flex flex-col items-center gap-3 rounded border p-4 text-center">
        <p className="text-sm text-red-600">실행 상세를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          다시 시도
        </button>
      </aside>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <aside className="flex flex-col gap-4 rounded border p-4">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold">{BATCH_JOB_TYPE_LABELS[run.jobType]}</h2>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
          닫기
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-2 py-0.5 text-xs ${BATCH_RUN_STATUS_BADGE_CLASSES[run.status]}`}>
          {BATCH_RUN_STATUS_LABELS[run.status]}
        </span>
        {run.isCarriedOver && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800">
            {CARRIED_OVER_BADGE_LABEL}
          </span>
        )}
        {run.targetMarket && <span className="text-gray-500">시장: {run.targetMarket}</span>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">시작</dt>
        <dd>{formatKstDateTime(run.startedAt)}</dd>
        <dt className="text-gray-500">종료</dt>
        <dd>{run.finishedAt ? formatKstDateTime(run.finishedAt) : "-"}</dd>
        {run.finishedAt && (
          <>
            <dt className="text-gray-500">소요 시간</dt>
            <dd>{formatRunDuration(run.startedAt, run.finishedAt)}</dd>
          </>
        )}
        <dt className="text-gray-500">처리 건수</dt>
        <dd>{run.processedCount.toLocaleString("ko-KR")}</dd>
        <dt className="text-gray-500">실패 건수</dt>
        <dd>{run.failedCount.toLocaleString("ko-KR")}</dd>
      </dl>

      <div>
        <h3 className="text-sm font-medium">실행 요약 로그</h3>
        {run.errorLog ? (
          <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 p-2 font-mono text-xs">
            {run.errorLog}
          </pre>
        ) : (
          <p className="mt-1 text-sm text-gray-500">{NO_ERROR_LOG_MESSAGE}</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium">종목 단위 실패 목록</h3>
        <div className="mt-1">{failuresSlot}</div>
      </div>
    </aside>
  );
}
