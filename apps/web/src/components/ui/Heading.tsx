import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 제목 프리미티브 (타입 스케일 통일, DESIGN.md §3).
 * 시그니처 = weight 300 + 네거티브 트래킹(text-heading/subheading/body-lg 복합 토큰에 내장).
 * 가벼움이 권위다 — 웨이트가 아니라 크기·트래킹·색으로 위계를 만든다.
 * level 1=페이지 제목(32px), 2=섹션 제목(22px), 3=패널 소제목(18px).
 */
type HeadingProps = {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
  id?: string;
};

const STYLES: Record<NonNullable<HeadingProps["level"]>, string> = {
  1: "text-heading text-fg text-balance",
  2: "text-subheading text-fg",
  3: "text-body-lg text-fg",
};

export function Heading({ level = 2, className, children, id }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={cn(STYLES[level], className)}>
      {children}
    </Tag>
  );
}
