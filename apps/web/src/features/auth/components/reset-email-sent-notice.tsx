import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

type ResetEmailSentNoticeProps = {
  onBack: () => void;
};

/** 발송 안내 Presenter — 계정 존재 여부와 무관한 통일 문구(BR-1). */
export function ResetEmailSentNotice({ onBack }: ResetEmailSentNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{AUTH_PASSWORD_RESET_MESSAGES.sentTitle}</h1>
      <p>{AUTH_PASSWORD_RESET_MESSAGES.sentBody}</p>
      <button type="button" onClick={onBack} className="underline self-start">
        {AUTH_PASSWORD_RESET_MESSAGES.backToRequest}
      </button>
    </div>
  );
}
