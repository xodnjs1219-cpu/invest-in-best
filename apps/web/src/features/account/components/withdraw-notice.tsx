import { Button, Heading } from "@/components/ui";
import { ACCOUNT_MESSAGES, WITHDRAW_NOTICE_ITEMS } from "@/features/account/constants";

type WithdrawNoticeProps = {
  onCancel: () => void;
  onProceed: () => void;
};

/** 1단계 안내 Presenter — 삭제 범위·복구 불가 안내. 로직 없음. */
export function WithdrawNotice({ onCancel, onProceed }: WithdrawNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>{ACCOUNT_MESSAGES.noticeTitle}</Heading>
      <ul className="flex flex-col gap-2 list-disc pl-5">
        {WITHDRAW_NOTICE_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {ACCOUNT_MESSAGES.cancelLabel}
        </Button>
        <Button type="button" variant="danger" onClick={onProceed}>
          {ACCOUNT_MESSAGES.continueLabel}
        </Button>
      </div>
    </div>
  );
}
