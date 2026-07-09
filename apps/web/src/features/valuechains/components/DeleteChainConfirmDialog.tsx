import { Button, Card } from "@/components/ui";
import {
  buildDeleteConfirmDescription,
  DELETE_CANCEL_LABEL,
  DELETE_CONFIRM_ACTION_LABEL,
  DELETE_CONFIRM_TITLE,
  DELETE_PENDING_LABEL,
} from "@/features/valuechains/constants/delete";

export type DeleteChainConfirmDialogProps = {
  open: boolean;
  chainName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 삭제 확인 다이얼로그 Presenter (UC-019 plan 모듈 8) — shadcn-ui 미설치 환경이므로
 * 순수 HTML + Tailwind로 구현한다. 되돌릴 수 없음·종속 데이터 삭제 안내(BR-7, Main 2) +
 * [삭제]/[취소] 액션. 진행 중(`isDeleting`)에는 양쪽 버튼을 비활성화해 이탈/중복 확정을 막는다.
 */
export function DeleteChainConfirmDialog({
  open,
  chainName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteChainConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chain-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <Card className="w-full max-w-sm p-5 shadow-[var(--shadow-md)]">
        <h2 id="delete-chain-dialog-title" className="text-base font-semibold text-fg">
          {DELETE_CONFIRM_TITLE}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">{buildDeleteConfirmDescription(chainName)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
            {DELETE_CANCEL_LABEL}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? DELETE_PENDING_LABEL : DELETE_CONFIRM_ACTION_LABEL}
          </Button>
        </div>
      </Card>
    </div>
  );
}
