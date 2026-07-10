import { Badge, Button, Heading } from "@/components/ui";
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
    <aside className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between">
        <Heading level={2}>
          {PROPOSAL_TYPE_LABELS[proposal.proposalType]} · {proposal.chain.name}
        </Heading>
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>

      <div className="text-sm">
        <p>
          {nodeLabel(proposal.sourceNode)} → {nodeLabel(proposal.targetNode)}
        </p>
        {proposal.relationType && (
          <p className="text-fg-muted">
            관계 종류: {proposal.relationType.name}
            {!proposal.relationType.isActive && "(비활성)"}
          </p>
        )}
        <div className="mt-1">
          <Badge tone="neutral">{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge>
        </div>
      </div>

      {proposal.disclosure && (
        <div className="rounded-[var(--radius)] border border-border p-3 text-sm">
          <p className="text-fg">{proposal.disclosure.title}</p>
          <p className="text-xs text-fg-muted">
            {proposal.disclosure.disclosureDate} · {proposal.disclosure.source}
          </p>
          <a
            href={proposal.disclosure.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline hover:text-accent-hover"
          >
            원문 보기
          </a>
        </div>
      )}

      <div>
        <Heading level={3}>LLM 근거 설명</Heading>
        <p className="text-sm text-fg-muted">{proposal.rationale}</p>
      </div>

      {/* 메타데이터(plan P4) — 생성일·기준 스냅샷. */}
      <dl className="text-xs text-fg-muted">
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
        <p className="rounded-[var(--radius)] bg-warning-soft p-2 text-xs text-warning">
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
          <Button
            variant="primary"
            size="sm"
            disabled={isProcessing}
            onClick={() => {
              if (window.confirm(APPROVE_CONFIRM_MESSAGE)) {
                onApprove(proposal.proposalId);
              }
            }}
          >
            승인
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isProcessing}
            onClick={() => onRejectClick(proposal.proposalId)}
          >
            거부
          </Button>
        </div>
      )}
    </aside>
  );
}
