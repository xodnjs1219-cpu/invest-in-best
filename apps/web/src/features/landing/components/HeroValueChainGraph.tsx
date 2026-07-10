/**
 * 히어로 배경용 밸류체인 마인드맵 데모 그래프 (순수 장식 SVG).
 * 실제 서비스의 노드-엣지 마인드맵 + 그룹 클러스터를 축약해 "무엇을 만드는 서비스인지"를
 * 첫 화면에서 즉시 각인시킨다. 데이터 페칭·상호작용 없음 — Server Component로 렌더된다.
 * 반도체 밸류체인(소재 → 장비/파운드리 → 완성품)을 예시로 삼는다.
 *
 * 색은 토큰 var()만 참조(DESIGN.md §2) — 라이트/다크 자동 대응.
 * 업스트림=data(cyan), 미드스트림=accent(indigo), 다운스트림=muted(fg-subtle).
 */

type Node = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  /** 그룹(밸류체인 단계) 색상 계열 */
  tone: "data" | "accent" | "muted";
  /** 강조 노드(가장 큰 원) 여부 */
  hero?: boolean;
};

type Edge = {
  from: string;
  to: string;
  /** 데이터 펄스 애니메이션 지연(초) — 시차를 두어 흐르는 느낌을 준다 */
  delay: number;
};

const NODES: Node[] = [
  { id: "mat-1", label: "소재·웨이퍼", sub: "Materials", x: 90, y: 90, tone: "data" },
  { id: "mat-2", label: "특수가스", sub: "Materials", x: 70, y: 220, tone: "data" },
  { id: "equip", label: "장비", sub: "Equipment", x: 250, y: 60, tone: "accent" },
  { id: "foundry", label: "파운드리", sub: "Foundry", x: 300, y: 180, tone: "accent", hero: true },
  { id: "design", label: "팹리스 설계", sub: "Fabless", x: 250, y: 300, tone: "accent" },
  { id: "device", label: "완성품·세트", sub: "Device", x: 490, y: 120, tone: "muted" },
  { id: "consumer", label: "최종 수요", sub: "Demand", x: 500, y: 270, tone: "muted" },
];

const EDGES: Edge[] = [
  { from: "mat-1", to: "equip", delay: 0 },
  { from: "mat-1", to: "foundry", delay: 0.4 },
  { from: "mat-2", to: "foundry", delay: 0.8 },
  { from: "equip", to: "foundry", delay: 0.2 },
  { from: "design", to: "foundry", delay: 1.1 },
  { from: "foundry", to: "device", delay: 0.6 },
  { from: "device", to: "consumer", delay: 1.4 },
];

const TONE_STROKE: Record<Node["tone"], string> = {
  data: "var(--data)",
  accent: "var(--accent)",
  muted: "var(--fg-subtle)",
};

const nodeById = (id: string): Node => NODES.find((n) => n.id === id) as Node;

export function HeroValueChainGraph() {
  return (
    <svg
      viewBox="0 0 580 380"
      className="h-full w-full"
      role="img"
      aria-label="반도체 밸류체인을 소재·장비·완성품 단계로 잇는 마인드맵 예시"
    >
      <defs>
        {/* 장식 그라디언트는 data→accent 2-stop만 (§4 Decorative) */}
        <linearGradient id="edge-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--data)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 그룹 클러스터 배경(밸류체인 단계 묶음) — radius 스케일(12px) 준수 */}
      <g opacity="0.6">
        <rect
          x="24"
          y="40"
          width="150"
          height="230"
          rx="12"
          fill="var(--data)"
          fillOpacity="0.05"
          stroke="var(--data)"
          strokeOpacity="0.3"
          strokeDasharray="4 6"
        />
        <rect
          x="196"
          y="24"
          width="180"
          height="316"
          rx="12"
          fill="var(--accent)"
          fillOpacity="0.05"
          stroke="var(--accent)"
          strokeOpacity="0.3"
          strokeDasharray="4 6"
        />
        <rect
          x="428"
          y="76"
          width="132"
          height="240"
          rx="12"
          fill="var(--fg-subtle)"
          fillOpacity="0.05"
          stroke="var(--fg-subtle)"
          strokeOpacity="0.3"
          strokeDasharray="4 6"
        />
      </g>

      {/* 엣지(관계선) + 흐르는 데이터 펄스(시그니처 유지) */}
      <g strokeLinecap="round" fill="none">
        {EDGES.map((edge) => {
          const a = nodeById(edge.from);
          const b = nodeById(edge.to);
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="url(#edge-grad)"
                strokeWidth="1.5"
                opacity="0.35"
              />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="url(#edge-grad)"
                strokeWidth="2.5"
                strokeDasharray="10 210"
                data-animate-landing
                style={{
                  animation: `var(--animate-landing-pulse-line)`,
                  animationDelay: `${edge.delay}s`,
                }}
              />
            </g>
          );
        })}
      </g>

      {/* 노드(시장 참여 주체) — 도구다움을 위해 정적 렌더(개별 부유 애니메이션 없음) */}
      {NODES.map((node) => {
        const r = node.hero ? 30 : 22;
        const stroke = TONE_STROKE[node.tone];
        return (
          <g key={node.id}>
            {node.hero && <circle cx={node.x} cy={node.y} r="52" fill="url(#node-glow)" />}
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill="var(--surface-raised)"
              stroke={stroke}
              strokeWidth={node.hero ? 2.5 : 1.5}
            />
            <circle cx={node.x} cy={node.y} r={r - 7} fill={stroke} opacity="0.1" />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="400"
              fill="var(--fg)"
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + 12}
              textAnchor="middle"
              fontSize="6.5"
              fill={stroke}
              opacity="0.85"
            >
              {node.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
