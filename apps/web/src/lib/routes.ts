import type { IsoDate } from "@iib/domain";

/**
 * 공통 경로 빌더 (UC-011 plan 모듈 9, UC-008과 공유).
 * `buildCompanyDetailPath` — 기업 상세 페이지 URL 계약(`?market=` 티커 충돌 구분, `?asOf=` 시점 컨텍스트).
 */
export const buildCompanyDetailPath = (input: {
  ticker: string;
  market: "KRX" | "US";
  asOf?: IsoDate | null;
}): string => {
  const params = new URLSearchParams({ market: input.market });
  if (input.asOf) {
    params.set("asOf", input.asOf);
  }
  return `/companies/${encodeURIComponent(input.ticker)}?${params.toString()}`;
};
