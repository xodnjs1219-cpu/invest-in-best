import { MainExplorePage } from "@/features/explore/components/MainExplorePage";

/**
 * 메인/탐색 페이지 셸 (UC-007 plan 모듈 E-1) — Server Component: 클라이언트 경계 배치만.
 * 데이터 페칭·로직 없음(목록은 클라이언트 쿼리 훅이 담당 — 영역별 독립 로딩/오류 처리를 위해
 * SSR 프리페치는 하지 않는 최소 구성).
 */
export default function Home() {
  return <MainExplorePage />;
}
