import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service-client";
import { SITE_URL } from "@/constants/site";
import { ROUTES } from "@/constants/routes";

/**
 * 동적 URL 조회 상한 — 사이트맵 프로토콜 권장(단일 파일 50,000 URL) 내에서 안전하게 제한.
 * 초과 규모가 되면 sitemap 분할(index)로 전환한다.
 */
const MAX_DYNAMIC_URLS = 5000;

/** ISO(YYYY-MM-DD…) 문자열을 sitemap `lastModified`용 Date로 파싱(실패 시 null). */
const toDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * sitemap.xml (App Router 파일 규약, `/sitemap.xml`로 서빙).
 * 정적 공개 페이지 + 동적 공개 리소스(공식·비보관 밸류체인, 상장 종목 상세)를 노출한다.
 * DB 조회가 실패하더라도 정적 경로는 항상 포함되도록 방어적으로 구성한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}${ROUTES.home}`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}${ROUTES.explore}`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}${ROUTES.terms}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}${ROUTES.privacy}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}${ROUTES.disclaimer}`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    // 공개 밸류체인: 공식(chain_type='official') + 비보관(is_archived=false).
    const { data: chains } = await supabase
      .from("value_chains")
      .select("id, updated_at")
      .eq("chain_type", "official")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(MAX_DYNAMIC_URLS);

    for (const chain of chains ?? []) {
      dynamicEntries.push({
        url: `${SITE_URL}/valuechains/${chain.id}`,
        lastModified: toDate(chain.updated_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    // 기업 상세: 상장 종목만(상장폐지 제외). 경로는 /companies/{ticker}?market=… 규약을 따른다.
    const { data: securities } = await supabase
      .from("securities")
      .select("ticker, market, updated_at")
      .eq("listing_status", "listed")
      .order("updated_at", { ascending: false })
      .limit(MAX_DYNAMIC_URLS);

    for (const sec of securities ?? []) {
      dynamicEntries.push({
        url: `${SITE_URL}/companies/${encodeURIComponent(sec.ticker)}?market=${sec.market}`,
        lastModified: toDate(sec.updated_at),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    // DB 접근 실패(빌드 시 환경변수 부재 등) 시 정적 경로만 반환 — sitemap 자체는 항상 유효하게 유지.
  }

  return [...staticEntries, ...dynamicEntries];
}
