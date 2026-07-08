import type { SecurityRef } from "@iib/domain";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

/**
 * UC-008 종목 검색 결과 → 편집 도메인 SecurityRef 매핑 (UC-013 plan 모듈 20).
 * 순수 함수 — FocusSecuritySearch(대상 기업 지정)와 UC-015(노드 추가 검색 탭)가 공유한다.
 */
export function toSecurityRef(item: SecuritySearchItem): SecurityRef {
  return {
    securityId: item.id,
    ticker: item.ticker,
    name: item.name,
    market: item.market,
  };
}
