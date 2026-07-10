import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 폼 컨트롤 프리미티브 (Input/Textarea/Select).
 * 감사 결과 모든 input이 무스타일 raw HTML이었다 — 테두리·포커스 링·placeholder 색을 토큰으로 통일한다.
 * `invalid` prop이 true면 danger 경계로 에러 상태를 시각화한다(aria-invalid도 함께 설정).
 */
/* §4 Inputs: 가라앉은 표면(surface-sunken) + radius-sm — 카드 위에서 입력 영역이 스스로 구분된다. */
const FIELD_BASE =
  "w-full rounded-sm border bg-surface-sunken px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60";

const borderClass = (invalid?: boolean) => (invalid ? "border-danger" : "border-border");

type InputProps = ComponentPropsWithoutRef<"input"> & { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, borderClass(invalid), className)}
      {...props}
    />
  );
}

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean };

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, "min-h-20 resize-y", borderClass(invalid), className)}
      {...props}
    />
  );
}

type SelectProps = ComponentPropsWithoutRef<"select"> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, "pr-8", borderClass(invalid), className)}
      {...props}
    >
      {children}
    </select>
  );
}
