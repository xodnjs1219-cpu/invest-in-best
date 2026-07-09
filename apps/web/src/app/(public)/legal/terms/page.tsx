import type { Metadata } from "next";
import { getLegalPageDoc } from "@iib/domain";
import { LegalDocumentView } from "@/features/legal/components/LegalDocumentView";

const doc = getLegalPageDoc("terms_of_service");

export const metadata: Metadata = {
  title: doc.title,
  description: `${doc.title} — invest-in-best 서비스 이용에 관한 약관.`,
  alternates: { canonical: "/legal/terms" },
  openGraph: {
    title: doc.title,
    url: "/legal/terms",
  },
};

/**
 * 이용약관 페이지 (UC-025 plan B-3) — Server Component, 정적 세그먼트.
 * fetch·쿼리·동적 API 미사용 → Next.js가 빌드 타임 정적 렌더링(spec §6.2, E6).
 */
export default function TermsPage() {
  return <LegalDocumentView doc={doc} />;
}
