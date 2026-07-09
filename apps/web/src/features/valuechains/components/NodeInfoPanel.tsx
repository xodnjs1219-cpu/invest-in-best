"use client";

import { SUBJECT_TYPE_LABELS } from "@iib/domain";
import { Badge, Button, Heading, Skeleton } from "@/components/ui";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";

/**
 * 노드 정보 패널 (UC-011 plan 모듈 15) — Presenter. `nodePanel.status` 판별 렌더.
 * 자유 주체는 정확히 3개 필드(이름/주체 유형/설명 메모) + 그룹 부가 표시(BR-2).
 */
export const NodeInfoPanel = () => {
  const { nodePanel } = useChainViewState();
  const { closeNodePanel, retryNodeDetail } = useChainViewActions();

  if (nodePanel.status === "closed" || nodePanel.status === "routing") {
    return null;
  }

  return (
    <aside
      data-testid="node-info-panel"
      className="rounded-[var(--radius-lg)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)]"
      aria-label="노드 정보 패널"
    >
      {nodePanel.status === "loading" && (
        <div data-testid="node-panel-skeleton" className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {nodePanel.status === "error" && (
        <div className="space-y-2 text-sm text-fg-muted">
          <p>노드 정보를 불러오지 못했습니다.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={retryNodeDetail}>
              다시 시도
            </Button>
            <Button variant="secondary" size="sm" onClick={closeNodePanel}>
              닫기
            </Button>
          </div>
        </div>
      )}

      {nodePanel.status === "security-fallback" && (
        <div className="space-y-2 text-sm text-fg-muted">
          <p>기업 정보를 확인할 수 없어 상세 페이지로 이동할 수 없습니다.</p>
          <Button variant="secondary" size="sm" onClick={closeNodePanel}>
            닫기
          </Button>
        </div>
      )}

      {nodePanel.status === "free-subject" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Heading level={3} className="text-base">
              {nodePanel.data.name ?? "이름 없음"}
            </Heading>
            <button
              type="button"
              onClick={closeNodePanel}
              aria-label="패널 닫기"
              className="text-xs text-fg-subtle hover:text-fg-muted"
            >
              닫기
            </button>
          </div>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline text-fg-muted">주체 유형: </dt>
              <dd className="inline text-fg">
                {nodePanel.data.subjectType ? SUBJECT_TYPE_LABELS[nodePanel.data.subjectType] : "-"}
              </dd>
            </div>
            <div>
              <dt className="inline text-fg-muted">설명 메모: </dt>
              <dd className="inline text-fg">{nodePanel.data.memo ?? "—"}</dd>
            </div>
          </dl>
          {nodePanel.data.groupName && <Badge tone="neutral">그룹: {nodePanel.data.groupName}</Badge>}
        </div>
      )}
    </aside>
  );
};
