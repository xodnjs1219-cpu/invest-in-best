import Link from "next/link";
import { AUTH_OAUTH_MESSAGES } from "@/features/auth/constants";

type GoogleLoginButtonProps = {
  onClick: () => void;
  isPending: boolean;
  errorMessage?: string;
};

/**
 * Google 로그인 버튼 Presenter — 로직 없음(훅은 상위 조립부에서 연결).
 * 버튼 하단에 약관 동의 고지 문구를 함께 노출한다(spec Main Scenario 1).
 */
export function GoogleLoginButton({ onClick, isPending, errorMessage }: GoogleLoginButtonProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded border px-4 py-2"
      >
        {isPending ? AUTH_OAUTH_MESSAGES.googleButtonLoadingLabel : AUTH_OAUTH_MESSAGES.googleButtonLabel}
      </button>
      <p className="text-xs text-gray-500">
        {AUTH_OAUTH_MESSAGES.consentNotice}{" "}
        <Link href="/legal/terms" target="_blank" rel="noreferrer" className="underline">
          이용약관
        </Link>{" "}
        <Link href="/legal/privacy" target="_blank" rel="noreferrer" className="underline">
          개인정보처리방침
        </Link>
      </p>
      {errorMessage && (
        <p role="alert" className="text-red-600 text-sm">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
