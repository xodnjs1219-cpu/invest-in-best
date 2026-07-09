/**
 * 과거 일봉 백필(Phase 1)의 수집 하한 거래일 계산.
 * 기준일(now)로부터 N개월 전 날짜를 yyyy-MM-dd(UTC)로 반환한다. 이 날짜 이전 봉은 수집하지 않는다.
 */

/**
 * now 기준 lookbackMonths 개월 전의 날짜를 yyyy-MM-dd(UTC) 문자열로 반환한다.
 * 월 경계 안전: 대상 월에 해당 일자가 없으면(예: 3/31 → 2월) 그 달 말일로 보정한다.
 */
export function computeQuotesBackfillCutoff(now: Date, lookbackMonths: number): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  const day = now.getUTCDate();

  const targetMonthIndex = month - lookbackMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  // 대상 월의 말일(해당 월 다음 달 0일). day가 말일을 넘으면 말일로 클램프.
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  const cutoff = new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
  return cutoff.toISOString().slice(0, 10);
}
