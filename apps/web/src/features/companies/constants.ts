import { DATA_SOURCE_LABELS } from "@iib/domain";

/**
 * 기업 상세(UC-020) UI 문구 상수 — 하드코딩 금지 원칙에 따라 화면 텍스트를 전부 이곳에 정의한다.
 * plan 모듈 15.
 */

export const COMPANY_NOT_FOUND_MESSAGE = "해당 기업을 찾을 수 없습니다. 상장 여부를 확인해 주세요.";
export const COMPANY_NOT_FOUND_HOME_LABEL = "메인으로 이동";
export const COMPANY_NOT_FOUND_SEARCH_LABEL = "다시 검색하기";

export const MARKET_SELECT_PROMPT_MESSAGE =
  "동일한 티커가 한국거래소(KRX)와 미국(US) 시장에 모두 존재합니다. 조회할 시장을 선택해 주세요.";
export const MARKET_SELECT_KRX_LABEL = "한국거래소(KRX)";
export const MARKET_SELECT_US_LABEL = "미국(US)";

export const PROFILE_NOT_COLLECTED_MESSAGE = "정형 정보가 아직 수집되지 않았습니다.";

export const DATA_SOURCE_LABEL_BY_MARKET: Record<"KRX" | "US", string> = {
  KRX: `${DATA_SOURCE_LABELS[0]} + ${DATA_SOURCE_LABELS[2]}`,
  US: `${DATA_SOURCE_LABELS[1]} + ${DATA_SOURCE_LABELS[2]}`,
};

export const LAST_COLLECTED_NOT_YET_LABEL = "수집 전";

export const FINANCIALS_EMPTY_MESSAGE =
  "재무 데이터가 없습니다. 2015 사업연도 이전 데이터는 제공하지 않으며, 신규 상장 종목은 아직 수집되지 않았을 수 있습니다.";
export const FINANCIALS_ANNUAL_ONLY_NOTE = "이 기업은 분기 손익을 제공하지 않아 연간 기준으로 표시합니다.";
export const FINANCIALS_REVENUE_UNMAPPED_NOTE = "매출 계정을 식별하지 못해 표시하지 않습니다.";
export const FINANCIALS_DERIVED_FROM_CUMULATIVE_NOTE = "누적 실적에서 당해 분기 값을 차감해 산출한 값입니다.";
export const FINANCIALS_SECTION_ERROR_MESSAGE = "재무 정보를 불러오지 못했습니다.";
export const FINANCIALS_RETRY_LABEL = "다시 시도";

export const DISCLOSURES_EMPTY_MESSAGE = "공시 내역이 없습니다.";
export const DISCLOSURES_SECTION_ERROR_MESSAGE = "공시 목록을 불러오지 못했습니다.";
export const DISCLOSURES_LOAD_MORE_LABEL = "더보기";
export const DISCLOSURES_LOADING_MORE_LABEL = "불러오는 중…";

export const QUOTES_UNCONFIRMED_LABEL = "종가 미확정";
export const QUOTES_SECTION_ERROR_MESSAGE = "주가·시가총액 정보를 불러오지 못했습니다.";
export const QUOTES_MARKET_CAP_MISSING_MESSAGE =
  "상장주식수 이력이 없어 시가총액 추이를 표시할 수 없습니다.";
export const QUOTES_SHARES_AS_OF_LABEL_PREFIX = "주식수 기준일";
export const QUOTES_MULTI_CLASS_PARTIAL_NOTE = "다중 클래스 주식 중 일부만 반영된 값입니다.";

export const CHAINS_EMPTY_MESSAGE = "소속된 밸류체인이 없습니다.";
export const CHAINS_SECTION_ERROR_MESSAGE = "소속 밸류체인 정보를 불러오지 못했습니다.";
export const CHAINS_SUMMARY_PENDING_LABEL = "집계 준비 중";
export const CHAINS_OFFICIAL_BADGE_LABEL = "공식 체인";
export const CHAINS_USER_BADGE_LABEL = "내 체인";
export const CHAINS_FOCUS_TYPE_LABEL: Record<"industry" | "company", string> = {
  industry: "산업 중심",
  company: "기업 중심",
};

export const SECTION_RETRY_LABEL = "다시 시도";

export const TIMELINE_NOTICE_TEMPLATE = (asOfDate: string) =>
  `본 페이지는 최신 데이터 기준으로 표시됩니다. 조회 중이던 시점(${asOfDate})의 밸류체인 구성과는 다를 수 있습니다.`;
export const TIMELINE_NOTICE_DISMISS_LABEL = "닫기";

export const HOMEPAGE_LINK_LABEL = "홈페이지 방문";
