"use client";

import { Button } from "@/components/ui";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { HERO_PRIMARY_CTA, HERO_SECONDARY_CTA } from "@/features/landing/constants";

const EXPLORE_PATH = "/explore";
const NEW_CHAIN_PATH = "/valuechains/new";
const LOGIN_PATH = "/auth/login";

/**
 * 히어로 CTA 버튼 쌍 (클라이언트 — 인증 상태에 따라 목적지 분기).
 * - 1차 CTA: 항상 탐색(`/explore`)으로 — 비로그인도 공식 체인 열람 가능(PRD Guest 권한).
 * - 2차 CTA: 로그인 시 생성 페이지, 비로그인 시 `returnTo`와 함께 로그인 유도
 *   (CreateChainButton과 동일한 복귀 규칙 — 엣지 10).
 * 시각 스펙은 Button 프리미티브(§4)가 SOT — 필 셰이프·그라디언트 금지.
 */
export function HeroActions() {
  const { status } = useCurrentUser();
  const isAuthenticated = status === "authenticated";

  const createHref = isAuthenticated
    ? NEW_CHAIN_PATH
    : `${LOGIN_PATH}?returnTo=${encodeURIComponent(NEW_CHAIN_PATH)}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button as="link" href={EXPLORE_PATH} className="group">
        {HERO_PRIMARY_CTA}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Button>
      <Button as="link" href={createHref} variant="secondary">
        {HERO_SECONDARY_CTA}
      </Button>
    </div>
  );
}
