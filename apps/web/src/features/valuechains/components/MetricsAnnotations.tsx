"use client";

import { useState } from "react";
import type { DailyAnnotations, QuarterlyAnnotations } from "@/features/valuechains/lib/dto";

export interface MetricsAnnotationsProps {
  variant: "daily" | "quarterly";
  annotations: DailyAnnotations | QuarterlyAnnotations;
}

/**
 * 지표 주석/툴팁 (UC-010 plan 모듈 26) — 주식수 기준일 범위(C-4)·환산 기준·매출 중복 안내·기준 통화 KRW.
 * 정보 아이콘 클릭 시 팝오버로 상세 고지 표시(shadcn-ui 미설치 — 순수 HTML+Tailwind 팝오버로 구현).
 */
export const MetricsAnnotations = ({ variant, annotations }: MetricsAnnotationsProps) => {
  const [open, setOpen] = useState(false);

  const fxBasisLabel = variant === "daily" ? "일별 = 당일 환율" : "분기 = 분기 말일 환율";

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label="지표 산정 기준 안내"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-strong text-[10px] text-fg-muted"
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-6 z-10 w-64 rounded-[var(--radius)] border border-border bg-surface-raised p-3 text-xs text-fg-muted shadow-[var(--shadow-md)]"
        >
          <p>기준 통화: {annotations.baseCurrency}</p>
          <p>환산 기준: {fxBasisLabel}</p>
          {variant === "daily" && "sharesAsOfDateMin" in annotations && (
            <>
              {annotations.sharesAsOfDateMin !== null && annotations.sharesAsOfDateMax !== null && (
                <p>
                  주식수 기준일:{" "}
                  {annotations.sharesAsOfDateMin === annotations.sharesAsOfDateMax
                    ? annotations.sharesAsOfDateMin
                    : `${annotations.sharesAsOfDateMin} ~ ${annotations.sharesAsOfDateMax}`}
                </p>
              )}
              {annotations.isClosingConfirmed === false && (
                <p className="text-warning">최신 일자 종가 미확정</p>
              )}
            </>
          )}
          {variant === "quarterly" && "revenueOverlapNotice" in annotations && annotations.revenueOverlapNotice && (
            <p>단계 간 거래 중복·비관련 사업부 매출이 포함될 수 있습니다.</p>
          )}
        </div>
      )}
    </span>
  );
};
