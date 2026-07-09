import Link from "next/link";
import { Heading } from "@/components/ui";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

/** 완료 안내 Presenter — 자동 로그인 없음(BR-4), 로그인 페이지로 유도. */
export function ResetSuccessNotice() {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>{AUTH_PASSWORD_RESET_MESSAGES.successTitle}</Heading>
      <p>{AUTH_PASSWORD_RESET_MESSAGES.successBody}</p>
      <Link
        href="/auth/login"
        className="text-accent hover:text-accent-hover underline underline-offset-2"
      >
        {AUTH_PASSWORD_RESET_MESSAGES.goToLogin}
      </Link>
    </div>
  );
}
