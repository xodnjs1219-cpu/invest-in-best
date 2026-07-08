import Link from "next/link";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

/** 완료 안내 Presenter — 자동 로그인 없음(BR-4), 로그인 페이지로 유도. */
export function ResetSuccessNotice() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{AUTH_PASSWORD_RESET_MESSAGES.successTitle}</h1>
      <p>{AUTH_PASSWORD_RESET_MESSAGES.successBody}</p>
      <Link href="/auth/login" className="underline">
        {AUTH_PASSWORD_RESET_MESSAGES.goToLogin}
      </Link>
    </div>
  );
}
