import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 공용 페이지 컨테이너 (폭·여백 통일).
 * 감사 결과 `mx-auto ... max-w-md px-4 py-12` 같은 셸 문자열이 여러 페이지에 복붙돼 있었다 —
 * width 프리셋으로 통일해 페이지 폭의 리듬을 맞춘다.
 */
type Width = "sm" | "md" | "lg" | "xl";

const MAX_W: Record<Width, string> = {
  sm: "max-w-md", // 인증·집중 폼
  md: "max-w-3xl", // 문서·상세
  lg: "max-w-5xl", // 목록·탐색
  xl: "max-w-6xl", // 어드민·대시보드
};

type PageShellProps = ComponentPropsWithoutRef<"main"> & { width?: Width };

export function PageShell({ width = "lg", className, ...props }: PageShellProps) {
  return (
    <main className={cn("mx-auto flex w-full flex-col gap-8 px-4 py-10", MAX_W[width], className)} {...props} />
  );
}
