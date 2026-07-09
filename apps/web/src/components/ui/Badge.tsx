import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 배지 프리미티브 (ring 방식으로 통일).
 * 감사 결과 배지가 ring 방식 vs 단순 bg 방식으로 분열되고, 경고색이 amber/orange/yellow 3계열로
 * 흩어져 있었다 — 의미(tone) 단위로 색을 하나씩 확정한다. 색상은 토큰 틴트를 참조해 다크 자동 대응.
 *
 * tone 의미:
 * - neutral: 중립 메타(유형·분류)   - accent: 정보·선택   - success: 성공·활성
 * - warning: 주의·이월·미확정        - danger: 실패·상장폐지  - data: KRX/시각화 계열
 */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "data";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-fg-muted ring-border-strong/60",
  accent: "bg-accent-soft text-accent-soft-fg ring-accent/25",
  success: "bg-success-soft text-success ring-success/25",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
  data: "bg-data-soft text-data ring-data/25",
};

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
