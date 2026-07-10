import { BATCH_JOB_TYPES, BATCH_RUN_STATUSES } from "@iib/domain";
import type { BatchJobType, BatchRunStatus } from "@iib/domain";
import { Button, Card } from "@/components/ui";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_LABELS,
  DEFAULT_LOOKBACK_NOTICE,
  FILTER_ALL_OPTION_LABEL,
  FILTER_RESET_BUTTON_LABEL,
} from "@/features/admin-batches/constants";

export type BatchRunFiltersValue = {
  jobType: BatchJobType | null;
  status: BatchRunStatus | null;
  from: string | null;
  to: string | null;
};

type BatchRunFiltersProps = {
  value: BatchRunFiltersValue;
  onChange: (patch: Partial<BatchRunFiltersValue>) => void;
  onReset: () => void;
};

/** 순수 Presenter — 작업 종류/상태/기간 필터 바(Main 5). 로직 없음, onChange 위임만. */
export function BatchRunFilters({ value, onChange, onReset }: BatchRunFiltersProps) {
  const isFromAfterTo = Boolean(value.from && value.to && value.from > value.to);

  return (
    <Card className="flex flex-wrap items-end gap-3 p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">작업 종류</span>
        <select
          value={value.jobType ?? ""}
          onChange={(event) =>
            onChange({ jobType: event.target.value ? (event.target.value as BatchJobType) : null })
          }
          className="rounded-[var(--radius)] border border-border bg-surface-raised px-2 py-1.5"
        >
          <option value="">{FILTER_ALL_OPTION_LABEL}</option>
          {BATCH_JOB_TYPES.map((jobType) => (
            <option key={jobType} value={jobType}>
              {BATCH_JOB_TYPE_LABELS[jobType]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">상태</span>
        <select
          value={value.status ?? ""}
          onChange={(event) =>
            onChange({ status: event.target.value ? (event.target.value as BatchRunStatus) : null })
          }
          className="rounded-[var(--radius)] border border-border bg-surface-raised px-2 py-1.5"
        >
          <option value="">{FILTER_ALL_OPTION_LABEL}</option>
          {BATCH_RUN_STATUSES.map((status) => (
            <option key={status} value={status}>
              {BATCH_RUN_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">시작일(부터)</span>
        <input
          type="datetime-local"
          value={value.from ?? ""}
          onChange={(event) => onChange({ from: event.target.value || null })}
          className="rounded-[var(--radius)] border border-border bg-surface-raised px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">시작일(까지)</span>
        <input
          type="datetime-local"
          value={value.to ?? ""}
          onChange={(event) => onChange({ to: event.target.value || null })}
          className="rounded-[var(--radius)] border border-border bg-surface-raised px-2 py-1.5"
        />
      </label>

      <Button variant="secondary" size="sm" onClick={onReset}>
        {FILTER_RESET_BUTTON_LABEL}
      </Button>

      {!value.from && !value.to && (
        <p className="basis-full text-xs text-fg-muted">{DEFAULT_LOOKBACK_NOTICE}</p>
      )}
      {isFromAfterTo && (
        <p className="basis-full text-xs text-danger">시작일(부터)은 시작일(까지)보다 이후일 수 없습니다.</p>
      )}
    </Card>
  );
}
