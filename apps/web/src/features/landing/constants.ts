/**
 * 랜딩페이지 카피/콘텐츠 상수 (SOT).
 * PRD §1(핵심 목표)·§3(포함 페이지)에서 도출한 서비스 강점을 마케팅 카피로 정리한다.
 * 문자열 하드코딩 금지 — 랜딩 프레젠터는 모두 이 상수를 순회해 렌더한다.
 */

/** 히어로 상단 배지 */
export const HERO_EYEBROW = "KRX · US 상장기업 밸류체인 인텔리전스";

/** 히어로 헤드라인(2줄 구성 — 두 번째 줄은 그라디언트 강조) */
export const HERO_TITLE_LEAD = "산업의 흐름을";
export const HERO_TITLE_ACCENT = "한 장의 마인드맵으로";

export const HERO_SUBTITLE =
  "소재부터 완성품까지, 기업을 노드로 잇고 관계를 엣지로 그립니다. 가치총액·매출 추이·과거 시점을 한 화면에서 탐색하는 밸류체인 기반 투자 인사이트.";

export const HERO_PRIMARY_CTA = "밸류체인 탐색하기";
export const HERO_SECONDARY_CTA = "내 밸류체인 만들기";

/** 히어로 하단 신뢰 지표(정성 표기 — 실측 수치가 아니라 서비스 특성 강조) */
export const HERO_STATS = [
  { value: "KRX + US", label: "국내·미국 통합 커버리지" },
  { value: "일 단위", label: "시가총액·환율 스냅샷" },
  { value: "2015~", label: "분기 재무 시계열" },
] as const;

/** 핵심 기능 섹션 카드 (PRD 핵심 목표 매핑) */
export const FEATURE_CARDS = [
  {
    icon: "graph",
    tone: "cyan",
    title: "밸류체인 마인드맵",
    desc: "산업·기업 중심 밸류체인을 노드-엣지로 시각화하고, 단계별 그룹 클러스터로 구조를 명확히 드러냅니다.",
  },
  {
    icon: "chart",
    tone: "violet",
    title: "현황 대시보드",
    desc: "가치총액과 구성 기업 매출 합계를 KRW로 환산해 제공하고, 시총 일단위·매출 분기단위 추이를 함께 봅니다.",
  },
  {
    icon: "clock",
    tone: "blue",
    title: "시점 타임라인",
    desc: "슬라이더와 스냅샷 마커로 과거 어느 날의 구조·그룹·지표든 그대로 복원해 비교합니다.",
  },
  {
    icon: "search",
    tone: "cyan",
    title: "통합 종목 검색",
    desc: "티커·종목명 부분 일치로 KRX·US를 한 번에 검색하고, 시장 배지와 필터로 원하는 종목을 빠르게 찾습니다.",
  },
  {
    icon: "edit",
    tone: "violet",
    title: "나만의 밸류체인",
    desc: "공식 체인을 복제하거나 빈 캔버스에서 직접 노드를 잇고 그룹핑해 나만의 투자 논리를 저장합니다.",
  },
  {
    icon: "shield",
    tone: "blue",
    title: "신뢰 가능한 데이터",
    desc: "DART·SEC·토스증권 정기 배치 수집에 LLM 관계 분석과 어드민 승인을 더해 출처·수집 시각을 표기합니다.",
  },
] as const;

/** 동작 방식 3단계 (사용자 여정 압축) */
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "산업을 고른다",
    desc: "반도체·2차전지 등 공식 밸류체인 카드에서 관심 산업을 선택해 마인드맵으로 진입합니다.",
  },
  {
    step: "02",
    title: "구조와 지표를 읽는다",
    desc: "노드를 클릭해 기업 재무·공시·주가를 확인하고, 대시보드로 밸류체인 전체 현황을 파악합니다.",
  },
  {
    step: "03",
    title: "내 논리로 재구성한다",
    desc: "체인을 복제하거나 새로 만들어 노드를 잇고 그룹으로 묶어 나만의 밸류체인을 저장합니다.",
  },
] as const;

/** 하단 최종 CTA */
export const FINAL_CTA_TITLE = "지금 산업의 지도를 펼쳐보세요";
export const FINAL_CTA_SUBTITLE =
  "로그인 없이도 공식 밸류체인과 기업 상세를 열람할 수 있습니다. 만들고 저장하려면 가입만 하면 됩니다.";

/** 면책(금융 서비스 필수 고지 — PRD §1 기준 정책) */
export const LANDING_DISCLAIMER =
  "모든 데이터는 정보 제공 목적이며 투자 권유가 아닙니다. 출처: 금융감독원 DART · SEC EDGAR · 토스증권.";
