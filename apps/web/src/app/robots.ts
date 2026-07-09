import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/site";

/**
 * robots.txt (App Router 파일 규약, `/robots.txt`로 서빙).
 * 공개 콘텐츠(메인·밸류체인 뷰·기업 상세·법적 고지)는 인덱싱 허용,
 * 인증/계정/어드민/API 및 편집·생성 라우트는 크롤 차단(비공개 성격).
 * sitemap을 함께 노출해 크롤러가 공개 URL을 발견하도록 한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/account/",
          "/admin/",
          "/valuechains/new",
          "/valuechains/*/edit",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
