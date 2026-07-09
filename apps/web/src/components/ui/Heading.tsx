import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 제목 프리미티브 (타입 스케일 통일).
 * 감사 결과 h1이 text-lg/xl/2xl, font-semibold/bold로 흩어져 있었다 — level 단위로 스케일을 확정한다.
 * level 1=페이지 제목, 2=섹션 제목, 3=패널 소제목.
 */
type HeadingProps = {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
  id?: string;
};

const STYLES: Record<NonNullable<HeadingProps["level"]>, string> = {
  1: "text-2xl font-bold tracking-tight text-fg text-balance",
  2: "text-lg font-semibold text-fg",
  3: "text-sm font-semibold text-fg",
};

export function Heading({ level = 2, className, children, id }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={cn(STYLES[level], className)}>
      {children}
    </Tag>
  );
}
