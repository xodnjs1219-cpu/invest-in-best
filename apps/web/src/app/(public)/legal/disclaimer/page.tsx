import type { Metadata } from "next";
import { getLegalPageDoc } from "@iib/domain";
import { LegalDocumentView } from "@/features/legal/components/LegalDocumentView";
import { DataSourcePolicySection } from "@/features/legal/components/DataSourcePolicySection";

const doc = getLegalPageDoc("investment_disclaimer");

export const metadata: Metadata = {
  title: doc.title,
  description: `${doc.title} — 모든 데이터는 정보 제공 목적이며 투자 권유가 아님을 안내합니다.`,
  alternates: { canonical: "/legal/disclaimer" },
  openGraph: {
    title: doc.title,
    url: "/legal/disclaimer",
  },
};

/**
 * 투자 면책 페이지 (UC-025 plan B-5) — Server Component, 정적 세그먼트.
 * 면책 전문 + 데이터 출처 표기 정책 섹션(BR-7)을 함께 노출한다.
 * fetch·쿼리·동적 API 미사용 → Next.js가 빌드 타임 정적 렌더링(spec §6.2, E6).
 */
export default function DisclaimerPage() {
  return (
    <LegalDocumentView doc={doc}>
      <DataSourcePolicySection />
    </LegalDocumentView>
  );
}
