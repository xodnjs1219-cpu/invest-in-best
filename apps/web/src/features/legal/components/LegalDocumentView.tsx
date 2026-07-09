import type { ReactNode } from "react";
import type { LegalDocContent } from "@iib/domain";
import { Heading } from "@/components/ui";

type LegalDocumentViewProps = {
  doc: LegalDocContent;
  children?: ReactNode;
};

/**
 * 정책 문서 뷰 (UC-025 plan B-1) — 제목·버전·시행일·본문 렌더링 Presenter.
 * 로직 없는 순수 컴포넌트(Server Component 호환)로 이용약관/개인정보처리방침/투자 면책 3개 페이지가 공용한다(DRY).
 * `children`은 면책 페이지 전용 출처 표기 섹션(DataSourcePolicySection) 장착 지점.
 */
export function LegalDocumentView({ doc, children }: LegalDocumentViewProps) {
  const paragraphs = doc.body.split("\n\n").filter((paragraph) => paragraph.length > 0);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Heading level={1}>{doc.title}</Heading>
        <p className="text-sm text-fg-muted">
          버전 {doc.version} · 시행일 {doc.effectiveDate}
        </p>
      </header>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-fg-muted">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      {children}
    </article>
  );
}
