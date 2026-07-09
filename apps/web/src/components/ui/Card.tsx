import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 카드/패널 컨테이너.
 * 감사 결과 카드가 `rounded border p-4`부터 무스타일까지 제각각이었다 — 표면·경계·반경을 토큰으로 통일한다.
 * `interactive`면 hover 시 살짝 떠오르는 상호작용 표면(클릭 가능한 카드)으로 렌더한다.
 */
type CardProps = ComponentPropsWithoutRef<"div"> & { interactive?: boolean };

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]",
        interactive &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}
