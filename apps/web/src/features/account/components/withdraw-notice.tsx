import { ACCOUNT_MESSAGES, WITHDRAW_NOTICE_ITEMS } from "@/features/account/constants";

type WithdrawNoticeProps = {
  onCancel: () => void;
  onProceed: () => void;
};

/** 1단계 안내 Presenter — 삭제 범위·복구 불가 안내. 로직 없음. */
export function WithdrawNotice({ onCancel, onProceed }: WithdrawNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{ACCOUNT_MESSAGES.noticeTitle}</h1>
      <ul className="flex flex-col gap-2 list-disc pl-5">
        {WITHDRAW_NOTICE_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}>
          {ACCOUNT_MESSAGES.cancelLabel}
        </button>
        <button type="button" onClick={onProceed}>
          {ACCOUNT_MESSAGES.continueLabel}
        </button>
      </div>
    </div>
  );
}
