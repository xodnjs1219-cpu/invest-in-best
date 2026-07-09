import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 상태 표현 프리미티브 (Skeleton / ErrorState / EmptyState).
 * 감사 결과 로딩·오류·빈 상태가 화면마다 스켈레톤/텍스트/카드형으로 제각각이었다 — 하나로 통일한다.
 */

/** 스켈레톤 블록 — 높이만 className으로 지정해 재사용한다. */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius)] bg-surface-sunken", className)}
      aria-hidden
      {...props}
    />
  );
}

/** 오류 상태 — 중앙 정렬 메시지 + 선택적 재시도. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "다시 시도",
  className,
}: {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
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
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** 빈 상태 — 중앙 정렬 안내 + 선택적 액션(children). */
export function EmptyState({
  message,
  children,
  className,
}: {
  message: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border px-4 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm text-fg-muted">{message}</p>
      {children}
    </div>
  );
}
