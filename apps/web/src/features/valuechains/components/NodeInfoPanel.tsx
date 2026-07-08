"use client";

import { SUBJECT_TYPE_LABELS } from "@iib/domain";
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
      className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      aria-label="노드 정보 패널"
    >
      {nodePanel.status === "loading" && (
        <div data-testid="node-panel-skeleton" className="space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      )}

      {nodePanel.status === "error" && (
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p>노드 정보를 불러오지 못했습니다.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retryNodeDetail}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={closeNodePanel}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {nodePanel.status === "security-fallback" && (
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p>기업 정보를 확인할 수 없어 상세 페이지로 이동할 수 없습니다.</p>
          <button
            type="button"
            onClick={closeNodePanel}
            className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            닫기
          </button>
        </div>
      )}

      {nodePanel.status === "free-subject" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {nodePanel.data.name ?? "이름 없음"}
            </h3>
            <button
              type="button"
              onClick={closeNodePanel}
              aria-label="패널 닫기"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              닫기
            </button>
          </div>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline text-gray-500 dark:text-gray-400">주체 유형: </dt>
              <dd className="inline text-gray-800 dark:text-gray-200">
                {nodePanel.data.subjectType ? SUBJECT_TYPE_LABELS[nodePanel.data.subjectType] : "-"}
              </dd>
            </div>
            <div>
              <dt className="inline text-gray-500 dark:text-gray-400">설명 메모: </dt>
              <dd className="inline text-gray-800 dark:text-gray-200">{nodePanel.data.memo ?? "—"}</dd>
            </div>
          </dl>
          {nodePanel.data.groupName && (
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              그룹: {nodePanel.data.groupName}
            </span>
          )}
        </div>
      )}
    </aside>
  );
};
