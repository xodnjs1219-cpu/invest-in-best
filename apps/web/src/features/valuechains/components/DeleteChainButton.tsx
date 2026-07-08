"use client";

import { DeleteChainConfirmDialog } from "@/features/valuechains/components/DeleteChainConfirmDialog";
import { DELETE_BUTTON_LABEL, DELETE_PENDING_LABEL } from "@/features/valuechains/constants/delete";
import { useDeleteChainAction } from "@/features/valuechains/hooks/useDeleteChainAction";

export type DeleteChainButtonProps = {
  chainId: string;
  chainName: string;
  source: "list" | "view";
  variant?: "card" | "header";
};

/**
 * 삭제 버튼 Presenter (UC-019 plan 모듈 9).
 * `useDeleteChainAction`만 소비하는 순수 표시 컴포넌트 — 내 체인 카드(`card`)와
 * 체인 뷰 헤더(`header`) 양쪽에서 재사용한다(UC-014 `CloneChainButton`과 동일 패턴).
 * 노출 조건(공식 체인 제외, 소유자만 등)은 배치하는 부모의 책임이다 — 서버가 최종 검증한다(BR-2).
 */
export function DeleteChainButton({
  chainId,
  chainName,
  source,
  variant = "header",
}: DeleteChainButtonProps) {
  const { isDialogOpen, requestDelete, confirmDelete, cancelDelete, isDeleting } =
    useDeleteChainAction({ chainId, chainName, source });

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (variant === "card") {
      // 카드 클릭(뷰 이동)과의 이벤트 버블링 차단.
      event.stopPropagation();
    }
    requestDelete();
  };

  const baseClassName =
    variant === "header"
      ? "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      : "rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <button type="button" onClick={handleClick} disabled={isDeleting} className={baseClassName}>
        {isDeleting ? DELETE_PENDING_LABEL : DELETE_BUTTON_LABEL}
      </button>
      <DeleteChainConfirmDialog
        open={isDialogOpen}
        chainName={chainName}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}
