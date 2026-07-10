import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 버튼 프리미티브 (디자인 시스템 SOT).
 * 감사에서 드러난 파편화(rounded/rounded-md 혼재, hover 누락, bg-blue-600 하드코딩)를 하나로 통일한다.
 * 색상은 토큰(accent/danger/surface)만 참조하므로 라이트·다크가 자동 대응된다.
 * `as="link"`면 next/link로, 아니면 <button>으로 렌더한다(동일한 시각 스펙 공유).
 */
export type ButtonVariant = "primary" | "danger" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-ambient",
  danger: "bg-danger text-accent-fg hover:bg-danger-hover shadow-ambient",
  secondary: "border border-border bg-surface-raised text-fg hover:bg-surface-hover",
  ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
  link: "text-accent underline underline-offset-2 hover:text-accent-hover",
};

/* DESIGN.md §3 Button(16px/400) + §8 터치 타깃(md 40px / sm 32px — sm은 데스크톱 밀집 UI 전용) */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 py-1 text-sm",
  md: "min-h-10 px-4 py-2 text-base",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & { as?: "button" };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps> & {
    as: "link";
    href: ComponentPropsWithoutRef<typeof Link>["href"];
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(BASE, VARIANTS[variant], variant === "link" ? "" : SIZES[size], className);

  // 시각 전용 props(variant/size/className/children/as)는 위에서 소비했으므로 DOM으로 넘기지 않는다.
  const { as, ...domProps } = props as Record<string, unknown> & { as?: "button" | "link" };
  delete domProps.variant;
  delete domProps.size;
  delete domProps.className;
  delete domProps.children;

  if (as === "link") {
    return (
      <Link className={classes} {...(domProps as ComponentPropsWithoutRef<typeof Link>)}>
        {children}
      </Link>
    );
  }

  const { type, ...buttonProps } = domProps as ComponentPropsWithoutRef<"button">;
  return (
    <button type={type ?? "button"} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
