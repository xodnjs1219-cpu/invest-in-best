import Link from "next/link";
import { FeatureIcon } from "@/features/landing/components/FeatureIcon";
import { HeroActions } from "@/features/landing/components/HeroActions";
import { HeroValueChainGraph } from "@/features/landing/components/HeroValueChainGraph";
import {
  FEATURE_CARDS,
  FINAL_CTA_SUBTITLE,
  FINAL_CTA_TITLE,
  HERO_EYEBROW,
  HERO_STATS,
  HERO_SUBTITLE,
  HERO_TITLE_ACCENT,
  HERO_TITLE_LEAD,
  HOW_IT_WORKS,
  LANDING_DISCLAIMER,
} from "@/features/landing/constants";

/** 기능 카드 톤 → Tailwind 색상 유틸 매핑(정적 클래스로 유지해 빌드 타임 퍼지 회피). */
const TONE_CLASS: Record<string, { text: string; ring: string; glow: string }> = {
  cyan: { text: "text-cyan-300", ring: "ring-cyan-400/20", glow: "bg-cyan-500/10" },
  violet: { text: "text-violet-300", ring: "ring-violet-400/20", glow: "bg-violet-500/10" },
  blue: { text: "text-blue-300", ring: "ring-blue-400/20", glow: "bg-blue-500/10" },
};

/**
 * 루트(`/`) 히어로 중심 랜딩페이지 (Server Component).
 * 서비스 강점(밸류체인 마인드맵·대시보드·타임라인·검색·개인화·데이터 신뢰)을 첫 화면에서 각인시키고
 * 탐색·생성으로 유도한다. 인터랙티브한 CTA만 클라이언트 컴포넌트(HeroActions)로 위임한다.
 *
 * 랜딩은 자체 다크 테마를 강제하므로 전역 라이트/다크 토큰과 무관하게 어두운 배경을 고정한다.
 */
export function LandingPage() {
  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      {/* ── 배경 오로라 글로우 ─────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          data-animate-landing
          className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-violet-600/20 blur-[120px]"
          style={{ animation: "var(--animate-landing-aurora)" }}
        />
        <div
          data-animate-landing
          className="absolute -right-32 top-20 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[120px]"
          style={{ animation: "var(--animate-landing-aurora)", animationDelay: "-7s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.12),transparent_60%)]" />
        {/* 미세 그리드 텍스처 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      {/* ── 히어로 ────────────────────────────────────── */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-14 px-4 pb-24 pt-16 lg:flex-row lg:gap-10 lg:pb-32 lg:pt-24">
        <div
          data-animate-landing
          className="flex flex-1 flex-col items-start gap-6"
          style={{ animation: "var(--animate-landing-rise)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-cyan-200 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </span>
            {HERO_EYEBROW}
          </span>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {HERO_TITLE_LEAD}
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-blue-300 bg-clip-text text-transparent">
              {HERO_TITLE_ACCENT}
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {HERO_SUBTITLE}
          </p>

          <HeroActions />

          {/* 신뢰 지표 */}
          <dl className="mt-4 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <dt className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
                  {stat.value}
                </dt>
                <dd className="text-xs leading-snug text-slate-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 히어로 마인드맵 데모 */}
        <div
          data-animate-landing
          className="relative w-full flex-1 lg:max-w-xl"
          style={{ animation: "var(--animate-landing-rise)", animationDelay: "0.15s" }}
        >
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 blur-2xl" />
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-violet-950/40 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <span className="ml-2 text-xs text-slate-400">반도체 밸류체인 · 마인드맵</span>
            </div>
            <div className="aspect-[580/380] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,0.6),rgba(2,6,23,0.9))]">
              <HeroValueChainGraph />
            </div>
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ─────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="mb-12 flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            산업을 읽는 여섯 가지 방법
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            흩어진 종목 데이터를 밸류체인이라는 하나의 구조로 엮어, 관계·지표·시점을 함께 봅니다.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const tone = TONE_CLASS[card.tone];
            return (
              <li
                key={card.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 ring-1 ${tone.ring} transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]`}
              >
                <div
                  className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${tone.glow} blur-2xl transition group-hover:scale-150`}
                  aria-hidden
                />
                <div
                  className={`relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/60 ${tone.text}`}
                >
                  <FeatureIcon name={card.icon} />
                </div>
                <h3 className="relative mb-2 text-lg font-semibold text-slate-50">{card.title}</h3>
                <p className="relative text-sm leading-relaxed text-slate-400">{card.desc}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 동작 방식 ─────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 sm:p-12">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            세 단계면 충분합니다
          </h2>
          <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <li key={item.step} className="relative flex flex-col gap-3">
                <span className="bg-gradient-to-br from-cyan-300 to-violet-400 bg-clip-text font-mono text-4xl font-bold text-transparent">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold text-slate-50">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{item.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-4 top-3 hidden text-2xl text-slate-700 md:block"
                  >
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 최종 CTA ──────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-slate-900 to-cyan-600/15 px-6 py-16 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.25),transparent_70%)]"
            aria-hidden
          />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            {FINAL_CTA_TITLE}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-slate-300">{FINAL_CTA_SUBTITLE}</p>
          <div className="relative mt-8 flex justify-center">
            <HeroActions />
          </div>
          <p className="relative mx-auto mt-10 max-w-2xl text-xs leading-relaxed text-slate-500">
            {LANDING_DISCLAIMER}
          </p>
          <Link
            href="/legal/disclaimer"
            className="relative mt-2 inline-block text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
          >
            투자 면책 고지 전문 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
