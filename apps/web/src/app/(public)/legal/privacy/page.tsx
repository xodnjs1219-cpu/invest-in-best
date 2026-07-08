import type { Metadata } from "next";
import { getLegalPageDoc } from "@iib/domain";
import { LegalDocumentView } from "@/features/legal/components/LegalDocumentView";

const doc = getLegalPageDoc("privacy_policy");

export const metadata: Metadata = { title: doc.title };

/**
 * 개인정보처리방침 페이지 (UC-025 plan B-4) — Server Component, 정적 세그먼트.
 * fetch·쿼리·동적 API 미사용 → Next.js가 빌드 타임 정적 렌더링(spec §6.2, E6).
 */
export default function PrivacyPage() {
  return <LegalDocumentView doc={doc} />;
}
