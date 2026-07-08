import { formatKrwCompact } from "@/lib/formatting/number";
import type { ChainCardMetric } from "@/features/valuechains/lib/dto";

/**
 * 체인 카드 표시 파생 로직 (UC-007 plan 모듈 D-2) — 전부 순수 함수(React 비의존).
 * 문자열 리터럴은 이 파일에서 상수로 관리한다(하드코딩 산재 방지).
 */

const FOCUS_LABELS = {
  industry: "산업 중심",
  company: "기업 중심",
} as const;

type FocusType = "industry" | "company";

/** industry → "산업 중심" / company+기업명 → "기업 중심 · {기업명}" / company+null → "기업 중심"(결정 D-1). */
export const formatFocusLabel = (focusType: FocusType, focusCompanyName: string | null): string => {
  if (focusType === "industry") {
    return FOCUS_LABELS.industry;
  }
  if (focusCompanyName) {
    return `${FOCUS_LABELS.company} · ${focusCompanyName}`;
  }
  return FOCUS_LABELS.company;
};

export type MetricDisplay =
  | { kind: "unavailable" }
  | {
      kind: "value";
      text: string;
      coverageText: string;
      isCarriedForward: boolean;
      metricDate: string;
    };

/**
 * `latestMetric=null` → `{ kind: 'unavailable' }`(값 미표시 — 0과 구분, 엣지 3).
 * 값 존재 → KRW 축약 텍스트 + "반영 n/전체 m" 커버리지 문자열 + 이월 여부.
 */
export const formatMetricDisplay = (latestMetric: ChainCardMetric | null): MetricDisplay => {
  if (!latestMetric) {
    return { kind: "unavailable" };
  }

  return {
    kind: "value",
    text: formatKrwCompact(latestMetric.totalMarketCapKrw),
    coverageText: `반영 ${latestMetric.coveredNodeCount}/전체 ${latestMetric.totalNodeCount}`,
    isCarriedForward: latestMetric.isCarriedForward,
    metricDate: latestMetric.metricDate,
  };
};

/** "노드 N개" 표기(엣지 9: 0이어도 정상 표기). */
export const formatNodeCount = (count: number): string => `노드 ${count}개`;
