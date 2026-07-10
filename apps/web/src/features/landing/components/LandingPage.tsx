import { Badge, Card, NumericText } from "@/components/ui";
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
} from "@/features/landing/constants";

/** 기능 카드 톤 → 토큰 유틸 매핑(정적 클래스로 유지해 빌드 타임 퍼지 회피). data=cyan, accent=indigo. */
const TONE_CLASS: Record<string, string> = {
  data: "bg-data-soft text-data",
  accent: "bg-accent-soft text-accent-soft-fg",
};

/**
 * 루트(`/`) 히어로 중심 랜딩페이지 (Server Component).
 * 서비스 강점(밸류체인 마인드맵·대시보드·타임라인·검색·개인화·데이터 신뢰)을 첫 화면에서 각인시키고
 * 탐색·생성으로 유도한다. 인터랙티브한 CTA만 클라이언트 컴포넌트(HeroActions)로 위임한다.
 *
 * 랜딩도 전역 토큰 세계를 따른다(DESIGN.md §5) — 라이트 기본 + 다크 자동.
 * 장식 그라디언트는 accent(indigo)→data(cyan) 조합만, 배경 워시 등 장식 전용으로 허용된다.
 */
export function LandingPage() {
  return (
    <main className="relative overflow-hidden bg-surface text-fg">
      {/* ── 배경 워시(장식 전용 accent/data 저채도) ───────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* filter blur 대신 radial-gradient — 스케일 애니메이션에도 리-래스터가 없어 페인트가 싸다 */}
        <div
          data-animate-landing
          className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 12%, transparent), transparent)",
            animation: "var(--animate-landing-aurora)",
            willChange: "transform",
          }}
        />
        <div
          data-animate-landing
          className="absolute -right-32 top-20 h-[32rem] w-[32rem] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--data) 10%, transparent), transparent)",
            animation: "var(--animate-landing-aurora)",
            animationDelay: "-7s",
            willChange: "transform",
          }}
        />
      </div>

      {/* ── 히어로 ────────────────────────────────────── */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-14 px-4 pb-24 pt-16 lg:flex-row lg:gap-10 lg:pb-32 lg:pt-24">
        <div
          data-animate-landing
          className="flex flex-1 flex-col items-start gap-6"
          style={{ animation: "var(--animate-landing-rise)" }}
        >
          <Badge tone="data">{HERO_EYEBROW}</Badge>

          <h1 className="text-heading text-balance sm:text-display lg:text-display-hero">
            {HERO_TITLE_LEAD}
            <br />
            <span className="text-accent">{HERO_TITLE_ACCENT}</span>
          </h1>

          <p className="max-w-xl text-body-lg text-fg-muted">{HERO_SUBTITLE}</p>

          <HeroActions />

          {/* 신뢰 지표 */}
          <dl className="mt-4 grid w-full max-w-lg grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-3 sm:gap-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <NumericText as="dt" className="text-xl text-fg sm:text-2xl">
                  {stat.value}
                </NumericText>
                <dd className="text-xs leading-snug text-fg-subtle">{stat.label}</dd>
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
          <div className="absolute inset-0 -z-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-accent/15 to-data/10 blur-2xl" />
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-raised p-3 shadow-elevated">
            <div className="mb-3 flex items-center px-2 pt-1">
              <span className="text-xs text-fg-subtle">반도체 밸류체인 · 마인드맵</span>
            </div>
            <div className="aspect-[580/380] w-full overflow-hidden rounded-[var(--radius)] bg-surface-sunken">
              <HeroValueChainGraph />
            </div>
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ─────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="mb-12 flex flex-col items-center text-center">
          <h2 className="text-heading text-balance">산업을 읽는 여섯 가지 방법</h2>
          <p className="mt-3 max-w-2xl text-fg-muted">
            흩어진 종목 데이터를 밸류체인이라는 하나의 구조로 엮어, 관계·지표·시점을 함께 봅니다.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => (
            <li key={card.title}>
              <Card interactive className="h-full p-6">
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] ${TONE_CLASS[card.tone]}`}
                >
                  <FeatureIcon name={card.icon} />
                </div>
                <h3 className="mb-2 text-body-lg text-fg">{card.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{card.desc}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 동작 방식 ─────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface-raised p-8 shadow-standard sm:p-12">
          <h2 className="mb-10 text-center text-heading text-balance">세 단계면 충분합니다</h2>
          <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <li key={item.step} className="relative flex flex-col gap-3">
                <NumericText className="text-4xl text-data">{item.step}</NumericText>
                <h3 className="text-body-lg text-fg">{item.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{item.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-4 top-3 hidden text-2xl text-fg-subtle md:block"
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
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-accent/10 via-surface-raised to-data/10 px-6 py-16 text-center shadow-standard sm:px-12">
          <h2 className="relative mx-auto max-w-2xl text-heading text-balance">
            {FINAL_CTA_TITLE}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-fg-muted">{FINAL_CTA_SUBTITLE}</p>
          <div className="relative mt-8 flex justify-center">
            <HeroActions />
          </div>
        </div>
      </section>
    </main>
  );
}
