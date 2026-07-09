import { PageShell } from "@/components/ui";
import { PasswordResetFlow } from "@/features/auth/components/password-reset-flow";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token_hash?: string }>;
};

/**
 * `/auth/reset-password` — 비밀번호 재설정 페이지. Server Component.
 * Next.js 16 규약에 따라 `searchParams`는 Promise다. 메일 링크의 `token_hash`를 추출해
 * 플로우 컨테이너에 전달한다(로그인 상태 불요 — Precondition).
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token_hash: tokenHash } = await searchParams;

  return (
    <PageShell width="sm">
      <PasswordResetFlow tokenHash={tokenHash ?? null} />
    </PageShell>
  );
}
