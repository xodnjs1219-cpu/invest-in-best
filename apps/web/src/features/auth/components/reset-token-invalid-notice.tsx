import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

type ResetTokenInvalidNoticeProps = {
  onRequestAgain: () => void;
};

/** 무효 안내 Presenter — 만료/사용됨/위조를 구분하지 않는 통일 문구(BR-1). */
export function ResetTokenInvalidNotice({ onRequestAgain }: ResetTokenInvalidNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{AUTH_PASSWORD_RESET_MESSAGES.invalidTitle}</h1>
      <p>{AUTH_PASSWORD_RESET_MESSAGES.invalidBody}</p>
      <button type="button" onClick={onRequestAgain} className="underline self-start">
        {AUTH_PASSWORD_RESET_MESSAGES.requestAgain}
      </button>
    </div>
  );
}
