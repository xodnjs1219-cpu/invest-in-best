import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";

/**
 * Web App Manifest (App Router 파일 규약, `/manifest.webmanifest`로 서빙).
 * 홈 화면 추가·PWA 기본 정보를 제공한다. 아이콘은 favicon.ico를 재사용한다
 * (전용 PNG 아이콘 추가 시 `icons` 배열을 확장).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    // ui-exception(hex): PWA manifest는 리터럴 색 필수 — surface-raised(#ffffff)와 값 일치
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
