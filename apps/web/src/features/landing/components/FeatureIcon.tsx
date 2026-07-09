/**
 * 랜딩 기능 카드용 인라인 SVG 아이콘 (외부 아이콘 라이브러리 의존 없이 자체 제공).
 * 24x24 스트로크 아이콘. `currentColor`를 상속받아 카드 톤 색상으로 렌더된다.
 */

type IconName = "graph" | "chart" | "clock" | "search" | "edit" | "shield";

const PATHS: Record<IconName, React.ReactNode> = {
  graph: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
      <path d="M7.8 7.4 10.4 15M16.4 8.6 13.4 15.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16l3-4 3 2 4-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export function FeatureIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
