import Link from "next/link";
import { Heading } from "@/components/ui";
import { AUTH_VERIFY_ERROR_MESSAGES } from "@/features/auth/constants";

/**
 * 인증 링크 무효/만료 안내 + 재발송 유도 진입점.
 * 재발송 API는 UC-002 소관이므로 본 plan에서는 로그인(인증 안내) 화면으로 연결한다.
 */
export function VerifyErrorNotice() {
  return (
    <div data-testid="verify-error-notice" className="flex flex-col gap-4">
      <Heading level={1}>{AUTH_VERIFY_ERROR_MESSAGES.title}</Heading>
      <p>{AUTH_VERIFY_ERROR_MESSAGES.body}</p>
      <Link
        href="/auth/login"
        className="text-accent hover:text-accent-hover underline underline-offset-2"
      >
        {AUTH_VERIFY_ERROR_MESSAGES.goToLogin}
      </Link>
    </div>
  );
}
