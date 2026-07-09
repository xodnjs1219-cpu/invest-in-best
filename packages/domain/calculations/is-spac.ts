/**
 * 스팩(SPAC, 기업인수목적회사) 종목 판별 (UC-031 Phase 0 시드 제외).
 * 스팩은 실체 사업이 없는 인수 목적 페이퍼컴퍼니라 밸류체인/지표 분석 대상에서 제외한다.
 * 한국 스팩은 상호에 '스팩' 또는 '기업인수목적'을 포함하는 것이 관례(자본시장법상 명명).
 */

/** 한국 스팩 상호 패턴(한글). 공백 변형에 견고하도록 정규화 후 검사한다. */
const KR_SPAC_KEYWORDS = ["스팩", "기업인수목적"] as const;

/**
 * 영문 "SPAC"은 반드시 독립 단어로만 매칭한다(대소문자 무시). 부분 일치를 쓰면
 * "SPACE", "AEROSPACE", "SPACEX" 등 정상 우주·항공 기업을 오판하므로 단어 경계(\b)를 강제한다.
 */
const EN_SPAC_WORD = /\bSPAC\b/i;

/**
 * 종목명이 스팩(기업인수목적회사)에 해당하면 true.
 * 한국 상호(예: "삼성스팩10호", "삼성머스트기업인수목적5호")와
 * 영문 상호(예: "A SPAC II ACQUISITION CORP")를 모두 판정한다.
 * 한글은 공백 무시 부분 일치, 영문 "SPAC"은 독립 단어 매칭(SPACE/AEROSPACE 오탐 방지).
 */
export function isSpacName(name: string | null | undefined): boolean {
  if (!name) return false;
  const compact = name.replace(/\s+/g, "");
  if (KR_SPAC_KEYWORDS.some((kw) => compact.includes(kw))) return true;
  return EN_SPAC_WORD.test(name);
}
