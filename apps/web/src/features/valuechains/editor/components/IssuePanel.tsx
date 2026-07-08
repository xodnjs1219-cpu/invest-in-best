"use client";

import type { ServerIssue } from "@iib/domain";

/**
 * 이슈 패널(UC-018 plan 모듈 23) — 순수 Presenter. `clientIssues + serverIssues`를 코드→문구
 * + 대상 요소 수("엣지 2개")로 나열한다. 이슈 0건이면 미렌더. 캔버스 하이라이트(issueHighlight)와
 * 동일 대상을 가리킨다(연결은 ChainEditorPage 책임).
 */
export interface IssuePanelProps {
  clientIssues: ServerIssue[];
  serverIssues: ServerIssue[];
}

function describeTargets(targets: ServerIssue["targets"]): string | null {
  const parts: string[] = [];
  if (targets.clientNodeIds && targets.clientNodeIds.length > 0) {
    parts.push(`노드 ${targets.clientNodeIds.length}개`);
  }
  if (targets.clientEdgeIds && targets.clientEdgeIds.length > 0) {
    parts.push(`엣지 ${targets.clientEdgeIds.length}개`);
  }
  if (targets.clientGroupIds && targets.clientGroupIds.length > 0) {
    parts.push(`그룹 ${targets.clientGroupIds.length}개`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function IssuePanel({ clientIssues, serverIssues }: IssuePanelProps) {
  const allIssues = [...serverIssues, ...clientIssues];
  if (allIssues.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2">
      {allIssues.map((issue, index) => {
        const targetDescription = describeTargets(issue.targets);
        return (
          <p key={`${issue.code}-${index}`} className="text-sm text-red-700">
            {issue.message}
            {targetDescription && <span className="ml-1 text-red-500">({targetDescription})</span>}
          </p>
        );
      })}
    </div>
  );
}
