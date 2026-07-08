import { LLM_PROPOSAL_STATUSES } from "@iib/domain";
import { PROPOSAL_STATUS_LABELS } from "@/features/admin-llm-proposals/constants";
import type { ProposalStatusFilter } from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";

type ProposalFilterTabsProps = {
  value: ProposalStatusFilter;
  onChange: (filter: ProposalStatusFilter) => void;
};

/** 순수 Presenter — 4개 상태 필터 탭. 로직 없음, 이벤트 위임만. */
export function ProposalFilterTabs({ value, onChange }: ProposalFilterTabsProps) {
  return (
    <div className="flex gap-2 border-b">
      {LLM_PROPOSAL_STATUSES.map((status) => {
        const isActive = status === value;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(status)}
            className={
              isActive
                ? "border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-600"
                : "px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
            }
          >
            {PROPOSAL_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
