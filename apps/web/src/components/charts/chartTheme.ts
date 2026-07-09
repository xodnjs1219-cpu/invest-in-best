/**
 * 차트 색상 팔레트 SOT (라이트/다크).
 * 감사 결과 세 차트(Candlestick/Bar/Line)가 동일 팔레트를 각자 하드코딩·중복 정의하고,
 * Candlestick은 다크 대응이 아예 없었다 — 여기서 한 벌로 통일한다.
 *
 * lightweight-charts는 CSS 변수를 직접 못 받으므로 JS 값으로 주입해야 한다(getChartPalette).
 * recharts/SVG 차트는 CSS 변수(var(--chart-series-1) 등)를 그대로 써도 되지만, 일관성을 위해
 * 동일 팔레트 상수를 참조한다. 뉴트럴은 slate 계열로 디자인 토큰과 계보를 맞춘다.
 */

export type ChartPalette = {
  surface: string;
  text: string;
  grid: string;
  /** 시계열/막대 시리즈 색(최대 4계열) */
  series: readonly [string, string, string, string];
  /** 강조 시리즈(현재 시점·하이라이트) */
  seriesEmphasis: string;
  /** 재무 상승/하락/미확정 (캔들) */
  up: string;
  down: string;
  muted: string;
};

const LIGHT: ChartPalette = {
  surface: "#ffffff",
  text: "#475569", // slate-600
  grid: "#e2e8f0", // slate-200
  series: ["#6366f1", "#0891b2", "#16a34a", "#d97706"], // accent(indigo)·data(cyan)·success·warning
  seriesEmphasis: "#4338ca",
  up: "#16a34a",
  down: "#dc2626",
  muted: "#94a3b8", // slate-400
};

const DARK: ChartPalette = {
  surface: "#111827",
  text: "#9aa7bd",
  grid: "#1f2937",
  series: ["#818cf8", "#22d3ee", "#4ade80", "#fbbf24"],
  seriesEmphasis: "#a5b4fc",
  up: "#4ade80",
  down: "#f87171",
  muted: "#64748b",
};

/**
 * 현재 활성 테마의 차트 팔레트를 반환한다.
 * 뷰어 토글이 찍는 `data-theme` 속성을 우선하고, 없으면 OS `prefers-color-scheme`를 따른다.
 * SSR(window 부재)에서는 라이트를 기본값으로 반환한다.
 */
export function getChartPalette(): ChartPalette {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return LIGHT;
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return DARK;
  if (attr === "light") return LIGHT;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
}

/**
 * 테마 변경(OS `prefers-color-scheme` / 뷰어 토글 `data-theme`)을 구독한다. 정리 함수를 반환한다.
 * `matchMedia`·`MutationObserver`가 없는 환경(jsdom 등)에서는 해당 구독을 조용히 건너뛴다.
 */
export function subscribeThemeChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  mql?.addEventListener?.("change", callback);

  const observer =
    typeof MutationObserver === "function" ? new MutationObserver(callback) : null;
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => {
    mql?.removeEventListener?.("change", callback);
    observer?.disconnect();
  };
}
