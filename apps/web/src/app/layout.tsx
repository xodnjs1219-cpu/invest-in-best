import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/app/providers";
import { AppFooter } from "@/components/common/AppFooter";
import { GlobalHeader } from "@/components/layout/global-header";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
} from "@/constants/site";
import "./globals.css";

/**
 * Pretendard Variable — 서비스 전역 본문/제목 서체(한글 최적화).
 * CDN CSP·폰트 로딩 실패 위험을 피하려 woff2를 셀프호스팅해 `next/font/local`로 배선한다
 * (`src/app/fonts/PretendardVariable.woff2`). weight 45~920 가변 축 전체를 한 파일로 커버한다.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "45 920",
  preload: true,
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "system-ui",
    "Segoe UI",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "sans-serif",
  ],
});

/** 숫자·데이터 정렬용 모노스페이스(재무 지표·티커 등). 본문 서체와 역할이 다르다. */
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/**
 * 앱 전역 기본 메타데이터 (SEO SOT).
 * - `metadataBase`: 하위 페이지의 상대 OG/canonical URL을 절대 URL로 승격.
 * - `title.template`: 하위 페이지 title이 `"<제목> | invest-in-best"` 형태로 자동 조합.
 * - OpenGraph/Twitter/robots/canonical을 기본값으로 배선 → 각 페이지는 필요한 필드만 덮어쓴다.
 * 아이콘·매니페스트는 App Router 파일 규약(favicon.ico, manifest.ts, opengraph-image.tsx)이 자동 배선한다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 밸류체인 마인드맵 투자 인사이트`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: SITE_URL,
    title: `${SITE_NAME} — 밸류체인 마인드맵 투자 인사이트`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — 밸류체인 마인드맵 투자 인사이트`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-surface text-fg flex min-h-full flex-col font-sans">
        <Providers>
          <GlobalHeader />
          {children}
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
