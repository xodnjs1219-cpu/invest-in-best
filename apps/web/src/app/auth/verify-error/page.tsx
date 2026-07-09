import { PageShell } from "@/components/ui";
import { VerifyErrorNotice } from "@/features/auth/components/verify-error-notice";

/** `/auth/verify-error` — 인증 토큰 무효/만료 시 랜딩 페이지. */
export default function VerifyErrorPage() {
  return (
    <PageShell width="sm">
      <VerifyErrorNotice />
    </PageShell>
  );
}
