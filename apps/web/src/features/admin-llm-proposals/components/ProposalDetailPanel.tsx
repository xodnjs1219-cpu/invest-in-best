import type { ProposalListItem } from "@/features/admin-llm-proposals/lib/dto";
import {
  APPLICABILITY_REASON_LABELS,
  APPROVE_CONFIRM_MESSAGE,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
} from "@/features/admin-llm-proposals/constants";

type ProposalDetailPanelProps = {
  proposal: ProposalListItem | null;
  isProcessing: boolean;
  onClose: () => void;
  onApprove: (proposalId: string) => void;
  onRejectClick: (proposalId: string) => void;
};

const nodeLabel = (node: ProposalListItem["sourceNode"]) =>
  node.ticker ? `${node.displayName} (${node.ticker})` : node.displayName;

/** 순수 Presenter — 제안 상세 패널(spec 4-B-7 검토 동선). proposal=null이면 미렌더. */
export function ProposalDetailPanel({
  proposal,
  isProcessing,
  onClose,
  onApprove,
  onRejectClick,
}: ProposalDetailPanelProps) {
  if (!proposal) {
    return null;
  }

  const isPending = proposal.status === "pending";

  return (
    <aside className="flex flex-col gap-4 rounded border p-4">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold">
          {PROPOSAL_TYPE_LABELS[proposal.proposalType]} · {proposal.chain.name}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
          닫기
        </button>
      </div>

      <div className="text-sm">
        <p>
          {nodeLabel(proposal.sourceNode)} → {nodeLabel(proposal.targetNode)}
        </p>
        {proposal.relationType && (
          <p className="text-gray-600">
            관계 종류: {proposal.relationType.name}
            {!proposal.relationType.isActive && "(비활성)"}
          </p>
        )}
        <p className="rounded bg-gray-100 px-2 py-0.5 text-xs inline-block mt-1">
          {PROPOSAL_STATUS_LABELS[proposal.status]}
        </p>
      </div>

      {proposal.disclosure && (
        <div className="rounded border p-3 text-sm">
          <p className="font-medium">{proposal.disclosure.title}</p>
          <p className="text-xs text-gray-500">
            {proposal.disclosure.disclosureDate} · {proposal.disclosure.source}
          </p>
          <a
            href={proposal.disclosure.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            원문 보기
          </a>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium">LLM 근거 설명</h3>
        <p className="text-sm text-gray-700">{proposal.rationale}</p>
      </div>

      {/* 메타데이터(plan P4) — 생성일·기준 스냅샷. */}
      <dl className="text-xs text-gray-500">
        <div className="flex gap-1">
          <dt>생성일:</dt>
          <dd>{proposal.createdAt}</dd>
        </div>
        <div className="flex gap-1">
          <dt>기준 스냅샷:</dt>
          <dd className="font-mono">{proposal.basedOnSnapshotId}</dd>
        </div>
      </dl>

      {!proposal.applicability.isApplicable && (
        <p className="rounded bg-orange-50 p-2 text-xs text-orange-800">
          {proposal.applicability.reason
            ? APPLICABILITY_REASON_LABELS[
                proposal.applicability.reason as keyof typeof APPLICABILITY_REASON_LABELS
              ]
            : "재검토가 필요합니다."}
          {" — 승인 시 자동 무효 처리될 수 있습니다."}
        </p>
      )}

      {isPending && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              if (window.confirm(APPROVE_CONFIRM_MESSAGE)) {
                onApprove(proposal.proposalId);
              }
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onRejectClick(proposal.proposalId)}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            거부
          </button>
        </div>
      )}
    </aside>
  );
}
