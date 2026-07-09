"use client";

import { Button } from "@/components/ui";
import { CLONE_BUTTON_LABEL, CLONE_PENDING_LABEL } from "@/features/valuechains/constants/clone";
import { useCloneChainAction } from "@/features/valuechains/hooks/useCloneChainAction";

export type CloneChainButtonProps = {
  chainId: string;
  variant?: "header" | "card";
};

/**
 * 복제 버튼 Presenter (UC-014 plan 모듈 13).
 * `useCloneChainAction`만 소비하는 순수 표시 컴포넌트 — chain-view 헤더(UC-009)와
 * main-explore 공식 체인 카드(UC-007) 양쪽에서 재사용한다. 진행 중 비활성화(Edge 10).
 */
export function CloneChainButton({ chainId, variant = "header" }: CloneChainButtonProps) {
  const { requestClone, isCloning, errorMessage, successMessage } = useCloneChainAction(chainId);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (variant === "card") {
      // 카드 클릭(뷰 이동)과의 이벤트 버블링 차단.
      event.stopPropagation();
    }
    requestClone();
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size={variant === "header" ? "md" : "sm"}
        onClick={handleClick}
        disabled={isCloning}
      >
        {isCloning ? CLONE_PENDING_LABEL : CLONE_BUTTON_LABEL}
      </Button>
      {errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
      {successMessage && <span className="text-xs text-success">{successMessage}</span>}
    </span>
  );
}
