import { Fragment } from "react";
import { Handle, Position } from "@xyflow/react";

/**
 * 노드 연결 핸들 — 뷰/편집 공용. 상하좌우 4변 모두에 연결점을 둔다.
 * 각 변에 source와 target 핸들을 겹쳐 배치해, 노드가 어디 있든 가장 가까운 변끼리 자연스럽게
 * 이을 수 있다(어느 변에서 시작해도 연결 가능). 방향(누가→누구)은 핸들 위치가 아니라 엣지의
 * 화살표·라벨 방향 아이콘이 담당한다(RelationEdge).
 *
 * 같은 변에 source/target을 겹치므로 각 핸들에 고유 id를 부여한다. React Flow는 연결 시
 * 커서에 가장 가까운 핸들을 선택하며, source/target 조합만 유효 연결로 처리한다.
 */

/* 핸들은 무채색 헤어라인 기본 + 노드 hover 시에만 노출(Figma식) — hover하면 accent로 승격. */
const HANDLE_BASE =
  "!h-2 !w-2 !rounded-full !border !border-border-strong !bg-surface-raised opacity-0 transition-[opacity,background-color,border-color] group-hover:opacity-100 hover:!border-accent hover:!bg-accent";

/** 4변 정의 — 각 변마다 source/target 핸들을 함께 렌더한다. */
const SIDES = [
  { pos: Position.Top, key: "t" },
  { pos: Position.Right, key: "r" },
  { pos: Position.Bottom, key: "b" },
  { pos: Position.Left, key: "l" },
] as const;

export function NodeHandles({
  isConnectable,
  hidden = false,
}: {
  isConnectable?: boolean;
  /** 원형 표시 등에서 연결점(핸들)을 감춘다. Floating 엣지는 핸들 위치와 무관하게 노드 경계로 붙으므로
   *  숨겨도 연결선은 정상 렌더된다. `!opacity-0`로 감추되 연결 자체는 유지(편집 캔버스에서 연결 가능). */
  hidden?: boolean;
}) {
  const handleClass = hidden ? `${HANDLE_BASE} !opacity-0` : HANDLE_BASE;
  return (
    <>
      {SIDES.map(({ pos, key }) => (
        <Fragment key={key}>
          <Handle
            id={`${key}-t`}
            type="target"
            position={pos}
            isConnectable={isConnectable}
            className={handleClass}
          />
          <Handle
            id={`${key}-s`}
            type="source"
            position={pos}
            isConnectable={isConnectable}
            className={handleClass}
          />
        </Fragment>
      ))}
    </>
  );
}
