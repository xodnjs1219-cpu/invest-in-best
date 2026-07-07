type HealthBadgeProps = {
  status: "ok" | "degraded";
};

/**
 * 환경 구축 검증용 최소 프레젠테이션 컴포넌트 예시.
 */
export function HealthBadge({ status }: HealthBadgeProps) {
  return <span data-testid="health-badge">{status === "ok" ? "정상" : "장애"}</span>;
}
