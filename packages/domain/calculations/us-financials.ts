/**
 * 미국(SEC) 재무 정규화 (docs/usecases/027/plan.md 모듈 4).
 * 순수 함수 — companyfacts JSON의 facts 서브트리(taxonomy:tag → fact[])를 입력으로 받는다.
 * BR-12~15, E3·E11~E14.
 */
import { arePeriodsContiguous, resolveCalendarPeriod, validatePeriodLength } from "./fiscal-calendar";
import type { AmountBasis, KrxQuarterRow } from "./krx-financials";

/** companyfacts USD(또는 shares) unit 배열의 fact 1건. */
export interface UsdFact {
  start: string;
  end: string;
  val: number;
  fy: number;
  fp: string; // "Q1"|"Q2"|"Q3"|"FY"
  form: string;
  filed: string;
  accn: string;
}

export type FactsByTag = Record<string, UsdFact[] | undefined>;

export interface PickRevenueResult {
  facts: UsdFact[];
  stubPeriods: UsdFact[];
  sourceTag: string | null;
  unmapped: boolean;
}

/**
 * 체인 순회로 태그별 facts 수집 → (fy,start,end) 중복 제거(최신 filed 채택) →
 * 기간 길이 검증 통과분만 채택, 위반분은 stubPeriods로 분리(E14). 전 태그 실패 시 unmapped:true(E3).
 */
export function pickRevenueFacts(facts: FactsByTag, chain: readonly string[]): PickRevenueResult {
  const collected: UsdFact[] = [];
  let sourceTag: string | null = null;

  for (const tag of chain) {
    const tagFacts = facts[tag];
    if (tagFacts && tagFacts.length > 0) {
      if (sourceTag === null) sourceTag = tag;
      collected.push(...tagFacts);
    }
  }

  if (collected.length === 0) {
    return { facts: [], stubPeriods: [], sourceTag: null, unmapped: true };
  }

  // (start, end) 기준 중복 제거 — 최신 filed 채택(§8.3).
  // 주의: 재수록분(비교표시)은 원본과 fy가 다를 수 있으므로(§8.3 실측: fy=2025→2026, 동일 start/end),
  // fy를 키에 포함하면 중복이 걸러지지 않는다. 기간(start/end)만으로 동일 보고 기간을 식별한다.
  const byKey = new Map<string, UsdFact>();
  for (const f of collected) {
    const key = `${f.start}|${f.end}`;
    const existing = byKey.get(key);
    if (!existing || f.filed >= existing.filed) {
      byKey.set(key, f);
    }
  }

  const deduped = [...byKey.values()];
  const validFacts: UsdFact[] = [];
  const stubPeriods: UsdFact[] = [];

  for (const f of deduped) {
    const kind = isAnnualLength(f) ? "annual" : "quarter";
    if (validatePeriodLength(f.start, f.end, kind)) {
      validFacts.push(f);
    } else {
      stubPeriods.push(f);
    }
  }

  return { facts: validFacts, stubPeriods, sourceTag, unmapped: false };
}

function isAnnualLength(f: UsdFact): boolean {
  const days = daysBetween(f.start, f.end);
  return days > 200; // annual(340~390) vs quarter(75~100) 구분을 위한 대략적 컷오프(정밀 검증은 validatePeriodLength)
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
}

export interface BuildUsQuarterRowsResult {
  rows: KrxQuarterRow[];
}

/**
 * 분기/연간 facts를 분리해 quarterly_financials 행 모델로 변환.
 * Q4는 FY - (Q1+Q2+Q3)로 파생(파생 전 3개 분기의 연속성 검증). 20-F 등 분기 facts 0건이면 annual 행만 생성(E13).
 */
export function buildUsQuarterRows(facts: UsdFact[]): BuildUsQuarterRowsResult {
  const quarterFacts = facts.filter((f) => f.fp !== "FY" && !isAnnualLength(f));
  const annualFacts = facts.filter((f) => f.fp === "FY" || isAnnualLength(f));

  const rows: KrxQuarterRow[] = [];

  // 20-F 연간 전용 판정: 분기 facts가 0건이고 연간 facts만 존재.
  if (quarterFacts.length === 0 && annualFacts.length > 0) {
    for (const f of annualFacts) {
      const { calendarYear } = resolveCalendarPeriod(f.start, f.end, "annual");
      rows.push({
        fiscalYear: f.fy,
        periodType: "annual",
        fiscalQuarter: null,
        amount: f.val,
        amountBasis: null,
      });
      void calendarYear; // calendar axis is derivable by the caller via resolveCalendarPeriod on period_start/end
    }
    return { rows };
  }

  // 분기 facts: fp 라벨을 신뢰하지 않고, 기간(start/end)만으로 취급. 각 (fy) 그룹별로 처리.
  const byFiscalYear = new Map<number, UsdFact[]>();
  for (const f of quarterFacts) {
    const arr = byFiscalYear.get(f.fy) ?? [];
    arr.push(f);
    byFiscalYear.set(f.fy, arr);
  }

  for (const [fy, qFacts] of byFiscalYear) {
    // fy 순서대로 기간 시작일 기준 정렬 — 최초 3개를 Q1~Q3로 간주(구조상 Q4는 원천에 없음, spec §8.1).
    const sorted = [...qFacts].sort((a, b) => a.start.localeCompare(b.start));
    for (const f of sorted) {
      const basis: AmountBasis = "three_month";
      rows.push({
        fiscalYear: fy,
        periodType: "quarter",
        fiscalQuarter: quarterIndexFromOrder(sorted, f),
        amount: f.val,
        amountBasis: basis,
      });
    }

    // Q4 파생: 동일 fy의 연간 facts와 결합.
    const annualForYear = annualFacts.find((a) => a.fy === fy);
    if (annualForYear && sorted.length === 3) {
      const periods = sorted.map((f) => ({ start: f.start, end: f.end }));
      if (arePeriodsContiguous(periods)) {
        const sumQ1Q3 = sorted.reduce((acc, f) => acc + f.val, 0);
        rows.push({
          fiscalYear: fy,
          periodType: "quarter",
          fiscalQuarter: 4,
          amount: annualForYear.val - sumQ1Q3,
          amountBasis: "derived_from_cumulative",
        });
      }
      // 연속성 검증 실패 시 Q4 파생 생략(E14) — 다른 분기는 그대로 유지.
    }
  }

  // 연간 행도 함께 저장(20-F가 아니어도 연간 값은 참고용으로 유지).
  for (const f of annualFacts) {
    rows.push({
      fiscalYear: f.fy,
      periodType: "annual",
      fiscalQuarter: null,
      amount: f.val,
      amountBasis: null,
    });
  }

  return { rows };
}

function quarterIndexFromOrder(sorted: UsdFact[], target: UsdFact): 1 | 2 | 3 {
  const idx = sorted.indexOf(target);
  return (idx + 1) as 1 | 2 | 3;
}

export interface PickSharesResult {
  shares: number;
  asOfDate: string;
  sourceTag: string;
  isPartial: boolean;
}

/**
 * 체인 순회 — 태그 존재 시 최신 end의 fact 채택. val:0 등 비정상값은 스킵하고 다음 태그로.
 * 전 단계 실패 시 null(E12 → 호출측이 shares_manual_override_needed 설정).
 */
export function pickSharesOutstanding(
  facts: FactsByTag,
  chain: ReadonlyArray<{ tag: string; partial: boolean }>,
): PickSharesResult | null {
  for (const { tag, partial } of chain) {
    const tagFacts = facts[tag];
    if (!tagFacts || tagFacts.length === 0) continue;

    const validFacts = tagFacts.filter((f) => f.val > 0);
    if (validFacts.length === 0) continue;

    const latest = [...validFacts].sort((a, b) => b.end.localeCompare(a.end))[0]!;
    return { shares: latest.val, asOfDate: latest.end, sourceTag: tag, isPartial: partial };
  }
  return null;
}

/** 최근 form에 10-Q 없이 20-F/40-F만 존재하는지(연간 전용 보조 판정). */
export function isAnnualOnlyFiler(recentForms: string[]): boolean {
  const hasQuarterly = recentForms.some((f) => f === "10-Q");
  const hasAnnualForeign = recentForms.some((f) => f === "20-F" || f === "40-F");
  return !hasQuarterly && hasAnnualForeign;
}
