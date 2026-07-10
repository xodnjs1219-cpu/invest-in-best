import type { ComponentPropsWithoutRef, ElementType, Ref } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 카드/패널 컨테이너.
 * 감사 결과 카드가 `rounded border p-4`부터 무스타일까지 제각각이었다 — 표면·경계·반경을 토큰으로 통일한다.
 * `interactive`면 hover 시 살짝 떠오르는 상호작용 표면(클릭 가능한 카드)으로 렌더한다.
 * `as`로 시맨틱 태그를 지정할 수 있다(aside/section 패널 등) — 기본 div.
 * `ref`는 React 19 ref-as-prop으로 그대로 전달된다(다이얼로그 포커스 트랩 등).
 */
type CardProps = ComponentPropsWithoutRef<"div"> & {
  interactive?: boolean;
  as?: ElementType;
  ref?: Ref<HTMLDivElement>;
};

export function Card({ className, interactive, as, ...props }: CardProps) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface-raised shadow-standard",
        interactive &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated",
        className,
      )}
      {...props}
    />
  );
}
