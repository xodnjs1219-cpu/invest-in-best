import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 상태 표현 프리미티브 (Skeleton / ErrorState / EmptyState).
 * 감사 결과 로딩·오류·빈 상태가 화면마다 스켈레톤/텍스트/카드형으로 제각각이었다 — 하나로 통일한다.
 */

/** 스켈레톤 블록 — 높이만 className으로 지정해 재사용한다. 최종 치수 그대로의 border 색 블록(§14). */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius)] bg-border", className)}
      aria-hidden
      {...props}
    />
  );
}

/**
 * 오류 상태 — 중앙 정렬 메시지 + 선택적 재시도(+보조 액션 children).
 * 메시지 규약(§14): 무엇이 실패했는지 + 다음 행동. "문제가 발생했습니다" 단독 금지.
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "다시 시도",
  children,
  className,
}: {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft px-4 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm text-danger">{message}</p>
      {(onRetry || children) && (
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 빈 상태 — 중앙 정렬 안내 + 선택적 액션(children).
 * variant="page"는 화면급 빈 상태(§14): 18px/300 한 문장 + primary CTA 하나. 일러스트 없음.
 * variant="inline"(기본)은 패널·리스트 내부의 컴팩트 빈 상태.
 */
export function EmptyState({
  message,
  children,
  variant = "inline",
  className,
}: {
  message: ReactNode;
  children?: ReactNode;
  variant?: "page" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border px-4 text-center",
        variant === "page" ? "py-16" : "py-12",
        className,
      )}
    >
      <p className={variant === "page" ? "text-body-lg text-fg" : "text-sm text-fg-muted"}>
        {message}
      </p>
      {children}
    </div>
  );
}
