import { Button } from "@/components/ui";
import { TIMELINE_NOTICE_DISMISS_LABEL, TIMELINE_NOTICE_TEMPLATE } from "@/features/companies/constants";

type TimelineContextNoticeProps = {
  asOfDate: string | null;
  isDismissed: boolean;
  onDismiss: () => void;
};

/**
 * E14 시점 컨텍스트 배너(UC-011 연계) — `asOf` 쿼리로 진입한 경우에만 표시.
 * 로직 없는 Presenter(state_management.md §6.2).
 */
export function TimelineContextNotice({ asOfDate, isDismissed, onDismiss }: TimelineContextNoticeProps) {
  if (!asOfDate || isDismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      <p>{TIMELINE_NOTICE_TEMPLATE(asOfDate)}</p>
      <Button variant="ghost" size="sm" onClick={onDismiss} className="shrink-0">
        {TIMELINE_NOTICE_DISMISS_LABEL}
      </Button>
    </div>
  );
}
