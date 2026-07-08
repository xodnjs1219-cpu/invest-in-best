/**
 * 숫자 포맷 유틸 (UC-007 plan 모듈 A-6). Postgres numeric 정밀도 보존을 위해 문자열로 전달되는
 * KRW 금액을 조/억 단위로 축약 표시한다. 대시보드(UC-010)·기업상세(UC-020)에서도 재사용한다.
 */

// 프로젝트 target(ES2017)이 BigInt 리터럴을 지원하지 않아 `BigInt(...)` 함수 호출로만 사용한다.
const EOK = BigInt(100_000_000); // 1억
const JO = BigInt(1_000_000_000_000); // 1조
const ZERO = BigInt(0);

const formatWithComma = (value: bigint): string => value.toLocaleString("en-US");

/**
 * numeric 문자열(KRW) → 사람이 읽기 쉬운 축약 표기.
 * - |value| >= 1조: "N조 M,MMM억원"(억 단위 나머지가 0이면 "N조원")
 * - |value| >= 1억: "N,NNN억원"
 * - 그 외: "N,NNN원"(콤마 구분)
 * 소수부는 표시에 영향 없는 정밀도이므로 정수부만 사용한다(원 단위 축약이라 절사).
 */
export const formatKrwCompact = (value: string): string => {
  const isNegative = value.trim().startsWith("-");
  const [integerPartRaw] = value.trim().replace(/^-/, "").split(".");
  const integerPart = BigInt(integerPartRaw || "0");
  const sign = isNegative ? "-" : "";

  if (integerPart >= JO) {
    const jo = integerPart / JO;
    const remainder = integerPart % JO;
    const eok = remainder / EOK;
    if (eok === ZERO) {
      return `${sign}${formatWithComma(jo)}조원`;
    }
    return `${sign}${formatWithComma(jo)}조 ${formatWithComma(eok)}억원`;
  }

  if (integerPart >= EOK) {
    const eok = integerPart / EOK;
    return `${sign}${formatWithComma(eok)}억원`;
  }

  return `${sign}${formatWithComma(integerPart)}원`;
};
