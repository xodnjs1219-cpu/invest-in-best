"use client";

import { Heading, Skeleton } from "@/components/ui";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";
import { TimelineSlider } from "@/features/valuechains/components/TimelineSlider";
import { TimelineCalendar } from "@/features/valuechains/components/TimelineCalendar";
import { TimelineBadge } from "@/features/valuechains/components/TimelineBadge";

/**
 * 타임라인 패널 컨테이너 (UC-012 plan 모듈 17) — 슬라이더/달력/마커 + 시점 배지.
 * Presenter — `useChainViewState()`/`useChainViewActions()` 두 훅만 소비.
 */
export const TimelinePanel = () => {
  const { timelineMeta, selectedDate, timelineBadge, restoreFailureNotice } = useChainViewState();
  const { selectTimelineDate, returnToLatest, clearRestoreFailureNotice } = useChainViewActions();

  return (
    <section className="space-y-3" aria-label="시점 타임라인">
      <Heading level={3}>시점 타임라인</Heading>

      {timelineMeta.status === "loading" && (
        <Skeleton data-testid="timeline-skeleton" className="h-10" />
      )}

      {timelineMeta.status === "error" && (
        <p className="text-sm text-fg-muted">타임라인 정보를 불러오지 못했습니다.</p>
      )}

      {timelineMeta.status === "ready" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[280px] flex-1">
              <TimelineSlider
                range={timelineMeta.range}
                markers={timelineMeta.markers}
                selectedDate={selectedDate}
                onSelectDate={selectTimelineDate}
              />
            </div>
            <TimelineCalendar range={timelineMeta.range} selectedDate={selectedDate} onSelectDate={selectTimelineDate} />
          </div>

          {timelineBadge && <TimelineBadge badge={timelineBadge} onReturnToLatest={returnToLatest} />}

          {restoreFailureNotice && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-xs text-warning ring-1 ring-inset ring-warning/25"
            >
              <span>
                {restoreFailureNotice.kind === "snapshot-not-found"
                  ? "이전 스냅샷이 없습니다(최소 시점 이전 날짜입니다)."
                  : "시점 복원 중 오류가 발생했습니다."}
              </span>
              <button type="button" onClick={clearRestoreFailureNotice} className="underline">
                닫기
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
