/**
 * 사이트 전역 SEO/메타데이터 상수 (SOT).
 * 서비스명·설명·기본 URL 등 메타데이터 관련 문자열을 한곳에서 관리한다.
 * layout metadata, robots.ts, sitemap.ts, manifest.ts, OG 이미지가 모두 이 상수를 참조한다
 * (문자열 중복 기입 금지 — routes.ts와 동일한 SOT 원칙).
 */

/** 서비스 정식 명칭 (PRD §제목). */
export const SITE_NAME = "invest-in-best";

/** 서비스 한 줄 소개 (PRD §개요). */
export const SITE_DESCRIPTION =
  "밸류체인 마인드맵 기반 투자 인사이트 웹 서비스. 산업·기업 중심 밸류체인을 마인드맵으로 시각화하고 핵심 지표와 과거 추이를 대시보드로 제공합니다.";

/**
 * 배포 사이트의 정규 URL (프로토콜 포함, 트레일링 슬래시 없음).
 * `metadataBase`·robots·sitemap의 절대 URL 조립 기준. 환경변수 미설정 시 로컬 개발 폴백을 사용한다.
 * 배포 환경에서는 `NEXT_PUBLIC_SITE_URL`을 반드시 설정한다.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** OpenGraph/Twitter 공통 로케일 (한국어 서비스). */
export const SITE_LOCALE = "ko_KR";

/** SEO 검색 키워드. */
export const SITE_KEYWORDS = [
  "밸류체인",
  "마인드맵",
  "투자",
  "투자 인사이트",
  "산업 분석",
  "기업 분석",
  "대시보드",
  "value chain",
] as const;
