/**
 * 히어로 배경용 밸류체인 마인드맵 데모 그래프 (순수 장식 SVG).
 * 실제 서비스의 노드-엣지 마인드맵 + 그룹 클러스터를 축약해 "무엇을 만드는 서비스인지"를
 * 첫 화면에서 즉시 각인시킨다. 데이터 페칭·상호작용 없음 — Server Component로 렌더된다.
 * 반도체 밸류체인(소재 → 장비/파운드리 → 완성품)을 예시로 삼는다.
 */

type Node = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  /** 그룹(밸류체인 단계) 색상 계열 */
  tone: "cyan" | "violet" | "blue";
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
  { id: "mat-1", label: "소재·웨이퍼", sub: "Materials", x: 90, y: 90, tone: "cyan" },
  { id: "mat-2", label: "특수가스", sub: "Materials", x: 70, y: 220, tone: "cyan" },
  { id: "equip", label: "장비", sub: "Equipment", x: 250, y: 60, tone: "violet" },
  { id: "foundry", label: "파운드리", sub: "Foundry", x: 300, y: 180, tone: "violet", hero: true },
  { id: "design", label: "팹리스 설계", sub: "Fabless", x: 250, y: 300, tone: "violet" },
  { id: "device", label: "완성품·세트", sub: "Device", x: 490, y: 120, tone: "blue" },
  { id: "consumer", label: "최종 수요", sub: "Demand", x: 500, y: 270, tone: "blue" },
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
  cyan: "#22d3ee",
  violet: "#8b5cf6",
  blue: "#3b82f6",
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
        <linearGradient id="edge-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </radialGradient>
        <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 그룹 클러스터 배경(밸류체인 단계 묶음) */}
      <g opacity="0.5">
        <rect
          x="24"
          y="40"
          width="150"
          height="230"
          rx="24"
          fill="rgba(34,211,238,0.05)"
          stroke="rgba(34,211,238,0.25)"
          strokeDasharray="4 6"
        />
        <rect
          x="196"
          y="24"
          width="180"
          height="316"
          rx="24"
          fill="rgba(139,92,246,0.05)"
          stroke="rgba(139,92,246,0.25)"
          strokeDasharray="4 6"
        />
        <rect
          x="428"
          y="76"
          width="132"
          height="240"
          rx="24"
          fill="rgba(59,130,246,0.05)"
          stroke="rgba(59,130,246,0.25)"
          strokeDasharray="4 6"
        />
      </g>

      {/* 엣지(관계선) + 흐르는 데이터 펄스 */}
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

      {/* 노드(시장 참여 주체) */}
      {NODES.map((node, i) => {
        const r = node.hero ? 30 : 22;
        const stroke = TONE_STROKE[node.tone];
        return (
          <g
            key={node.id}
            data-animate-landing
            style={{ animation: `var(--animate-landing-float)`, animationDelay: `${i * 0.5}s` }}
          >
            {node.hero && <circle cx={node.x} cy={node.y} r="52" fill="url(#node-glow)" />}
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill="rgba(5,7,14,0.85)"
              stroke={stroke}
              strokeWidth={node.hero ? 2.5 : 1.5}
              filter={node.hero ? "url(#soft-glow)" : undefined}
            />
            <circle cx={node.x} cy={node.y} r={r - 7} fill={stroke} opacity="0.12" />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill="#f8fafc"
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
