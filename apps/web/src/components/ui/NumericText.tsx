import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 수치 표기 프리미티브 (DESIGN.md §3 — "숫자는 일급 시민이다").
 * 열로 정렬되는 모든 숫자(시세·재무·건수·날짜 컬럼·KPI)는 Geist Mono + tabular-nums로
 * 자릿수를 고정한다. 본문 문장 속 숫자는 Pretendard 그대로 — 이 프리미티브를 쓰지 않는다.
 * 반복 구조(테이블 셀)는 NumericText, 단발 인라인은 `font-mono tabular` 클래스 콤보도 허용.
 */
type NumericTextProps<T extends ElementType> = {
  /** 렌더 태그 — 기본 span. 테이블 셀이면 "td"/"th", 정의 목록이면 "dd" 등 */
  as?: T;
  /** 열 정렬 수치는 우측 정렬이 기본 규약 */
  align?: "right";
  className?: string;
  children: ReactNode;
};

export function NumericText<T extends ElementType = "span">({
  as,
  align,
  className,
  children,
  ...props
}: NumericTextProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof NumericTextProps<T>>) {
  const Tag = (as ?? "span") as ElementType;
  return (
    <Tag
      className={cn("font-mono tabular", align === "right" && "text-right", className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
