import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { SUBJECT_TYPE_LABELS } from "@iib/domain";
import type { SubjectType } from "@/components/mindmap/types";

export type FreeSubjectNodeData = {
  label: string;
  subjectType: SubjectType;
};

export type FreeSubjectNodeType = Node<FreeSubjectNodeData>;

/** 자유 주체 노드 컴포넌트 (plan 모듈 A8) — 주체 이름 + 주체 유형 뱃지. */
export const FreeSubjectNode = ({ data, isConnectable }: NodeProps<FreeSubjectNodeType>) => {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 shadow-sm min-w-[120px]">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div className="font-medium text-sm text-gray-900">{data.label}</div>
      <span className="mt-1 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
        {SUBJECT_TYPE_LABELS[data.subjectType]}
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};
