import { VerifyErrorNotice } from "@/features/auth/components/verify-error-notice";

/** `/auth/verify-error` — 인증 토큰 무효/만료 시 랜딩 페이지. */
export default function VerifyErrorPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <VerifyErrorNotice />
    </main>
  );
}
