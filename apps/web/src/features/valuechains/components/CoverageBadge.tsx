/**
 * 커버리지 배지 (UC-010 plan 모듈 26) — "지표 반영 n / 전체 m 노드" 표기.
 * 일별/분기 공용(단일 컴포넌트 — DRY). 분기용 제외 기업 수(excludedUnmappedCount)는 옵션.
 */
export interface CoverageBadgeProps {
  covered: number;
  total: number;
  excludedUnmappedCount?: number;
}

export const CoverageBadge = ({ covered, total, excludedUnmappedCount }: CoverageBadgeProps) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
    지표 반영 {covered} / 전체 {total} 노드
    {typeof excludedUnmappedCount === "number" && excludedUnmappedCount > 0 && (
      <span className="text-gray-500 dark:text-gray-400">· 제외 {excludedUnmappedCount}개</span>
    )}
  </span>
);
