"use client";

import type { RelationType } from "@iib/domain";
import { Badge, Card, useDialogA11y } from "@/components/ui";

/**
 * 관계 종류 선택 팝오버(UC-016 plan 모듈 M20) — 신규 연결·관계 변경 공용.
 * 순수 Presenter: props로만 동작하고 자체 상태는 없다. 확정 시 `onSelect`만 호출 —
 * `addEdge`/`changeEdgeRelation` 호출과 차단 토스트는 호출측(컨테이너) 책임.
 */
export interface RelationTypePickerProps {
  /** 활성 관계 종류만 전달(호출측이 `computed.activeRelationTypes` 전달, BR-4). */
  relationTypes: RelationType[];
  onSelect: (relationTypeId: string) => void;
  onCancel: () => void;
  /** 변경 모드에서 현재 종류를 강조 표시. */
  currentRelationTypeId?: string;
}

export function RelationTypePicker({
  relationTypes,
  onSelect,
  onCancel,
  currentRelationTypeId,
}: RelationTypePickerProps) {
  // 팝오버형 다이얼로그 — Escape 닫기·초기 포커스·포커스 복원(마운트 = 열림).
  const dialogRef = useDialogA11y(true, onCancel);

  return (
    <Card
      ref={dialogRef}
      role="dialog"
      aria-label="관계 종류 선택"
      className="panel-enter flex w-64 flex-col gap-1 p-2"
    >
      {relationTypes.length === 0 ? (
        <p className="px-2 py-3 text-sm text-fg-muted">
          활성화된 관계 종류가 없습니다. 관리자에게 문의하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {relationTypes.map((relationType) => {
            const isCurrent = relationType.id === currentRelationTypeId;
            return (
              <li key={relationType.id}>
                <button
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => onSelect(relationType.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm hover:bg-surface-hover ${
                    isCurrent ? "bg-accent-soft text-accent-soft-fg" : ""
                  }`}
                >
                  <span>{relationType.name}</span>
                  <Badge tone={relationType.isDirected ? "accent" : "neutral"}>
                    {relationType.isDirected ? "유향" : "무향"}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1 flex justify-end border-t border-border pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius)] px-2 py-1 text-xs text-fg-muted hover:bg-surface-hover"
        >
          취소
        </button>
      </div>
    </Card>
  );
}
