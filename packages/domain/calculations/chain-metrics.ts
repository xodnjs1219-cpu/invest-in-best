/**
 * 체인 지표 계산 (docs/usecases/029/plan.md 모듈 4).
 * 유효 스냅샷 선정, 일별 가치총액·커버리지·이월 판정, 분기 매출 합산·제외 분류 — spec §6.1 산정 규칙의
 * 단일 구현(순수 함수, spec 시퀀스 다이어그램의 Domain participant).
 */
import type { CarryForwardResolution } from "./carry-forward";

/** 소수 2자리 반올림(numeric(28,2) 정합, chain_daily_metrics/chain_quarterly_metrics 컬럼 스케일). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface EffectiveSnapshotCandidate {
  readonly id: string;
  readonly effectiveAt: string;
}

/**
 * `effectiveAt <= boundaryIso`인 마지막 스냅샷을 선정한다(database.md §4.1 패턴).
 * `snapshots`는 호출측이 `effective_at` 오름차순으로 정렬해 전달한다(체인당 1회 로드해 재사용, E13).
 * 경계는 호출측이 `toSeoulDayEndIso(D)`(C-6)로 계산해 전달. 대상이 없으면 `null`(E7 스킵 신호).
 */
export function resolveEffectiveSnapshot(
  snapshots: ReadonlyArray<EffectiveSnapshotCandidate>,
  boundaryIso: string,
): EffectiveSnapshotCandidate | null {
  let result: EffectiveSnapshotCandidate | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.effectiveAt <= boundaryIso) {
      result = snapshot;
    } else {
      break;
    }
  }
  return result;
}

export interface ListedNode {
  readonly securityId: string;
  readonly currency: "KRW" | "USD";
}

export interface DailyChainMetricInput {
  readonly totalNodeCount: number;
  readonly listedNodes: ReadonlyArray<ListedNode>;
  readonly closeOf: (securityId: string) => CarryForwardResolution<number> | null;
  readonly sharesOf: (securityId: string) => number | null;
  readonly fxRateAt: () => CarryForwardResolution<number> | null;
}

export interface DailyChainMetricResult {
  readonly totalMarketCapKrw: number | null;
  readonly coveredNodeCount: number;
  readonly totalNodeCount: number;
  readonly isCarriedForward: boolean;
}

/**
 * 일별 가치총액 계산(spec §6.1) — 종목별 시총 = 종가 × 최신 주식수(현지 통화).
 * `currency='USD'`면 fx로 KRW 환산 — fx가 `null`(환율 축적 이전, H-9)이면 해당 종목을 합산·n에서 제외.
 * 종가 또는 주식수가 결측인 종목도 제외(E3, m은 유지).
 * `coveredNodeCount=0`(상장기업 0개 포함 — E1)이면 `totalMarketCapKrw=null`(0과 구분, BR 6.1).
 */
export function calculateDailyChainMetric(input: DailyChainMetricInput): DailyChainMetricResult {
  let sumKrw = 0;
  let coveredNodeCount = 0;
  let isCarriedForward = false;
  let fxResolutionCache: CarryForwardResolution<number> | null | undefined;

  const getFxResolution = (): CarryForwardResolution<number> | null => {
    if (fxResolutionCache === undefined) {
      fxResolutionCache = input.fxRateAt();
    }
    return fxResolutionCache;
  };

  for (const node of input.listedNodes) {
    const close = input.closeOf(node.securityId);
    if (close === null) continue; // E3 — 첫 관측 이전, 합산·n 제외

    const shares = input.sharesOf(node.securityId);
    if (shares === null) continue; // 주식수 결측 — 시총 계산 불가, 합산·n 제외

    // close는 위에서 이미 null 가드를 통과했으므로 close.value는 number다(calculateMarketCap의
    // closePrice: number|null 오버로드를 거치지 않고 직접 곱해 불필요한 단언을 피한다).
    let marketCapLocal = close.value * shares;
    let usedCarry = close.isCarried;

    if (node.currency === "USD") {
      const fx = getFxResolution();
      if (fx === null) continue; // H-9 — 환율 축적 이전, 해당 종목만 제외(부분 합산)
      marketCapLocal = marketCapLocal * fx.value;
      usedCarry = usedCarry || fx.isCarried;
    }

    sumKrw += marketCapLocal;
    coveredNodeCount += 1;
    if (usedCarry) isCarriedForward = true;
  }

  return {
    totalMarketCapKrw: coveredNodeCount === 0 ? null : round2(sumKrw),
    coveredNodeCount,
    totalNodeCount: input.totalNodeCount,
    isCarriedForward,
  };
}

export type QuarterlyConstituentClassification =
  | "included"
  | "excluded_unmapped"
  | "excluded_annual_only"
  | "excluded_no_fx"
  | "missing";

export interface QuarterlyConstituentInput {
  readonly quarterRow: {
    readonly revenue: number | null;
    readonly currency: "KRW" | "USD";
    readonly isRevenueTagUnmapped: boolean;
  } | null;
  readonly hasAnnualOnly: boolean;
  readonly fxRate: number | null;
}

/** 분기 매출 합산 대상 분류(spec §6.1·E8·H-9). */
export function classifyQuarterlyConstituent(input: QuarterlyConstituentInput): QuarterlyConstituentClassification {
  const { quarterRow, hasAnnualOnly, fxRate } = input;

  if (quarterRow !== null && quarterRow.isRevenueTagUnmapped) {
    return "excluded_unmapped";
  }
  if (quarterRow === null && hasAnnualOnly) {
    return "excluded_annual_only";
  }
  if (quarterRow !== null && quarterRow.revenue !== null) {
    if (quarterRow.currency === "KRW" || fxRate !== null) {
      return "included";
    }
    return "excluded_no_fx"; // H-9 — USD인데 환율 관측 전무
  }
  return "missing";
}

export interface QuarterlyConstituent {
  readonly securityId: string;
  readonly classification: QuarterlyConstituentClassification;
  readonly revenue: number | null;
  readonly currency: "KRW" | "USD";
  readonly fxRate: number | null;
}

export interface QuarterlyChainMetricResult {
  readonly totalRevenueKrw: number | null;
  readonly coveredNodeCount: number;
  readonly totalNodeCount: number;
  readonly excludedUnmappedCount: number;
}

/**
 * 분기 매출 합산(spec §6.1) — `included` 종목의 매출을 KRW 환산(분기 말일 환율, 이월 허용) 합산.
 * `excludedUnmappedCount` = 태그 미매핑 + 연간 전용(20-F) 제외 기업 수(spec §6.4 출력 계약).
 * `n=0`이면 `totalRevenueKrw=null`(E1·C-8 정합).
 */
export function calculateQuarterlyChainMetric(
  constituents: ReadonlyArray<QuarterlyConstituent>,
  totalNodeCount: number,
): QuarterlyChainMetricResult {
  let sumKrw = 0;
  let coveredNodeCount = 0;
  let excludedUnmappedCount = 0;

  for (const c of constituents) {
    if (c.classification === "included") {
      const revenueKrw = c.currency === "USD" ? (c.revenue as number) * (c.fxRate as number) : (c.revenue as number);
      sumKrw += revenueKrw;
      coveredNodeCount += 1;
    } else if (c.classification === "excluded_unmapped" || c.classification === "excluded_annual_only") {
      excludedUnmappedCount += 1;
    }
  }

  return {
    totalRevenueKrw: coveredNodeCount === 0 ? null : round2(sumKrw),
    coveredNodeCount,
    totalNodeCount,
    excludedUnmappedCount,
  };
}
