import Link from "next/link";
import { Heading } from "@/components/ui";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";

type SignupSuccessNoticeProps = {
  email: string;
  /** 최초 진입 컨텍스트(sanitizeReturnTo로 정제된 값) — 로그인 화면 이동 시 보존한다. */
  redirectTo?: string;
};

/**
 * 순수 Presenter — 가입 완료 + 인증 메일 발송 안내(계정 존재 여부와 무관한 통일 문구, E1).
 */
export function SignupSuccessNotice({ email, redirectTo }: SignupSuccessNoticeProps) {
  const loginHref = redirectTo
    ? `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : "/auth/login";

  return (
    <div data-testid="signup-success-notice" className="flex flex-col gap-4">
      <Heading level={1}>{AUTH_SIGNUP_MESSAGES.successTitle}</Heading>
      <p>{AUTH_SIGNUP_MESSAGES.successBodyTemplate(email)}</p>
      <Link
        href={loginHref}
        className="text-accent hover:text-accent-hover underline underline-offset-2"
      >
        {AUTH_SIGNUP_MESSAGES.goToLogin}
      </Link>
    </div>
  );
}
