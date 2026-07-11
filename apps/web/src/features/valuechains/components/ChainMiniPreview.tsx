import type { ReactElement } from "react";

/**
 * 밸류체인 카드 미니 미리보기 (탐색 목록) — 장식용 결정적 썸네일.
 * 카드 목록 API에는 구조 데이터가 없으므로(nodeCount뿐) 실제 그래프 대신,
 * chainId를 시드로 한 결정적 레이어드 미니 그래프(좌→우 3열)를 그린다:
 * 같은 체인은 항상 같은 그림이고, 점 개수는 실제 nodeCount를 반영(3~9 클램프)한다.
 * 색은 마인드맵 그룹 팔레트(--mm-group-1..3)와 동일한 시각 언어 — 순수 장식(aria-hidden).
 */

const VIEW_W = 96;
const VIEW_H = 64;
const COLUMN_X = [16, 48, 80] as const;
const MIN_DOTS = 3;
const MAX_DOTS = 9;

const COLUMN_FILLS = ["var(--mm-group-1)", "var(--mm-group-2)", "var(--mm-group-3)"] as const;

/** 문자열 → 32bit 시드 (djb2). */
const hashSeed = (value: string): number => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/** LCG 한 스텝 — [다음 상태, 0~1 값]. Math.random 없이 결정적. */
const nextRand = (state: number): [number, number] => {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next, next / 0xffffffff];
};

export interface MiniPreviewNode {
  x: number;
  y: number;
  column: 0 | 1 | 2;
}

export interface MiniPreviewEdge {
  from: MiniPreviewNode;
  to: MiniPreviewNode;
}

export interface MiniPreviewLayout {
  nodes: MiniPreviewNode[];
  edges: MiniPreviewEdge[];
}

/** 시드 기반 미니 그래프 레이아웃(순수 함수) — 테스트 가능하도록 분리. */
export function buildMiniPreviewLayout(chainId: string, nodeCount: number): MiniPreviewLayout {
  let seed = hashSeed(chainId);
  const rand = (): number => {
    const [next, value] = nextRand(seed);
    seed = next;
    return value;
  };

  const total = Math.min(MAX_DOTS, Math.max(MIN_DOTS, nodeCount));
  // 3열 분배 — 몫을 균등 배분하고 나머지는 가운데 → 왼쪽 순으로.
  const per = Math.floor(total / 3);
  const counts = [per, per, per];
  if (total % 3 >= 1) counts[1] += 1;
  if (total % 3 === 2) counts[0] += 1;

  const nodes: MiniPreviewNode[] = [];
  const byColumn: MiniPreviewNode[][] = [[], [], []];
  counts.forEach((count, column) => {
    for (let i = 0; i < count; i += 1) {
      // 열 안에서 위→아래 균등 배치 + 시드 지터(±5px) — 손으로 놓은 듯한 배치.
      const step = (VIEW_H - 20) / Math.max(1, count - 1 || 1);
      const baseY = count === 1 ? VIEW_H / 2 : 10 + step * i;
      const jitterY = (rand() - 0.5) * 10;
      const jitterX = (rand() - 0.5) * 8;
      const node: MiniPreviewNode = {
        x: COLUMN_X[column] + jitterX,
        y: Math.min(VIEW_H - 8, Math.max(8, baseY + jitterY)),
        column: column as 0 | 1 | 2,
      };
      nodes.push(node);
      byColumn[column].push(node);
    }
  });

  // 인접 열 연결 — 왼쪽 열의 각 점을 오른쪽 열의 시드 선택 점으로 잇는다(레이어드 DAG 느낌).
  const edges: MiniPreviewEdge[] = [];
  for (let column = 0; column < 2; column += 1) {
    const fromNodes = byColumn[column];
    const toNodes = byColumn[column + 1];
    if (fromNodes.length === 0 || toNodes.length === 0) continue;
    for (const from of fromNodes) {
      const to = toNodes[Math.floor(rand() * toNodes.length) % toNodes.length];
      edges.push({ from, to });
    }
  }

  return { nodes, edges };
}

export interface ChainMiniPreviewProps {
  chainId: string;
  nodeCount: number;
}

/** 카드 우측 미니 미리보기 — 순수 장식(클릭은 카드 오버레이가 담당). */
export function ChainMiniPreview({ chainId, nodeCount }: ChainMiniPreviewProps): ReactElement {
  const { nodes, edges } = buildMiniPreviewLayout(chainId, nodeCount);

  return (
    <div
      aria-hidden
      data-testid="chain-mini-preview"
      className="pointer-events-none shrink-0 self-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-sunken"
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-16 w-24">
        <g stroke="var(--border-strong)" strokeWidth="1" strokeLinecap="round">
          {edges.map((edge, i) => (
            <line key={i} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} />
          ))}
        </g>
        {nodes.map((node, i) => (
          <circle key={i} cx={node.x} cy={node.y} r={3.5} fill={COLUMN_FILLS[node.column]} />
        ))}
      </svg>
    </div>
  );
}
