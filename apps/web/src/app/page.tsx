import { LandingPage } from "@/features/landing/components/LandingPage";

/**
 * 루트(`/`) 랜딩페이지 셸 — Server Component: 클라이언트 경계 배치만.
 * 서비스 강점을 소개하고 탐색(`/explore`)·생성으로 유도한다.
 * 기존 검색+밸류체인 카드 목록(메인/탐색)은 `/explore`로 이동했다.
 */
export default function Home() {
  return <LandingPage />;
}
