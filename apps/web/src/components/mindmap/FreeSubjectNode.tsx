import { type Node, type NodeProps } from "@xyflow/react";
import { SUBJECT_TYPE_LABELS } from "@iib/domain";
import { nodeStateClass } from "@/components/mindmap/CompanyNode";
import { NodeDeleteButton } from "@/components/mindmap/NodeDeleteButton";
import { NodeHandles } from "@/components/mindmap/NodeHandles";
import type { SubjectType } from "@/components/mindmap/types";

export type FreeSubjectNodeData = {
  label: string;
  subjectType: SubjectType;
  /** 편집 캔버스에서만 주입 — 있으면 우상단에 삭제(×) 버튼을 렌더한다. */
  onDelete?: (nodeId: string) => void;
  /** 옵시디언식 hover — 강조/흐림(캔버스가 주입). */
  isEmphasized?: boolean;
  isDimmed?: boolean;
};

export type FreeSubjectNodeType = Node<FreeSubjectNodeData>;

/** 자유 주체 노드 컴포넌트 (plan 모듈 A8) — 주체 이름 + 주체 유형 뱃지. `data.onDelete` 시 삭제 버튼 노출. */
export const FreeSubjectNode = ({ id, data, isConnectable }: NodeProps<FreeSubjectNodeType>) => {
  return (
    <div
      data-animate-landing
      className={`group relative min-w-[120px] rounded-[var(--radius-lg)] border-2 border-dashed border-border-strong bg-surface-sunken px-4 py-2 shadow-[var(--shadow-sm)] ${nodeStateClass(data)}`}
    >
      {data.onDelete && (
        <NodeDeleteButton onDelete={() => data.onDelete?.(id)} label={`${data.label} 노드 삭제`} />
      )}
      <NodeHandles isConnectable={isConnectable} />
      <div className="text-sm font-medium text-fg">{data.label}</div>
      <span className="mt-1 inline-block rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-fg-muted ring-1 ring-inset ring-border">
        {SUBJECT_TYPE_LABELS[data.subjectType]}
      </span>
    </div>
  );
};
