import Link from "next/link";
import { Button } from "@/components/ui";
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
      <Button type="button" variant="secondary" onClick={onClick} disabled={isPending}>
        {isPending ? AUTH_OAUTH_MESSAGES.googleButtonLoadingLabel : AUTH_OAUTH_MESSAGES.googleButtonLabel}
      </Button>
      <p className="text-xs text-fg-muted">
        {AUTH_OAUTH_MESSAGES.consentNotice}{" "}
        <Link
          href="/legal/terms"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-accent-hover underline underline-offset-2"
        >
          이용약관
        </Link>{" "}
        <Link
          href="/legal/privacy"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-accent-hover underline underline-offset-2"
        >
          개인정보처리방침
        </Link>
      </p>
      {errorMessage && (
        <p role="alert" className="text-danger text-sm">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
