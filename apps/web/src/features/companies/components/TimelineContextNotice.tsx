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
      className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <p>{TIMELINE_NOTICE_TEMPLATE(asOfDate)}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
      >
        {TIMELINE_NOTICE_DISMISS_LABEL}
      </button>
    </div>
  );
}
