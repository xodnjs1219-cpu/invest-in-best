"use client";

import Link from "next/link";
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
 */
export function HeroActions() {
  const { status } = useCurrentUser();
  const isAuthenticated = status === "authenticated";

  const createHref = isAuthenticated
    ? NEW_CHAIN_PATH
    : `${LOGIN_PATH}?returnTo=${encodeURIComponent(NEW_CHAIN_PATH)}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href={EXPLORE_PATH}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition hover:shadow-xl hover:shadow-cyan-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {HERO_PRIMARY_CTA}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
      <Link
        href={createHref}
        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-100 backdrop-blur transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {HERO_SECONDARY_CTA}
      </Link>
    </div>
  );
}
