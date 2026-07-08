"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteChain } from "@/features/valuechains/hooks/useDeleteChain";
import { DELETE_SUCCESS_MESSAGE, getDeleteErrorMessage } from "@/features/valuechains/constants/delete";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/http/api-client";

export type DeleteChainActionParams = {
  chainId: string;
  chainName: string;
  source: "list" | "view";
};

export type DeleteChainActionResult = {
  isDialogOpen: boolean;
  requestDelete: () => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  isDeleting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

/**
 * 삭제 액션 훅(Container 로직, UC-019 plan 모듈 7).
 * 확인 다이얼로그 상태(BR-7)·확정 실행·성공 후 라우팅(뷰→목록)·에러 코드→문구 매핑을 담당한다.
 * main-explore·chain-view 어느 쪽의 Flux Store에도 Action을 추가하지 않는다 — 다이얼로그 개폐는
 * 이 훅의 로컬 상태(휘발), 서버 데이터 변화는 TanStack Query 캐시 소관(UC-014 선례).
 */
export const useDeleteChainAction = (params: DeleteChainActionParams): DeleteChainActionResult => {
  const { chainId, source } = params;
  const router = useRouter();
  const mutation = useDeleteChain();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestDelete = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDialogOpen(true);
  };

  const cancelDelete = () => {
    setIsDialogOpen(false);
  };

  const confirmDelete = () => {
    if (mutation.isPending) {
      return;
    }

    mutation.mutate(
      { chainId },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setSuccessMessage(DELETE_SUCCESS_MESSAGE);
          if (source === "view") {
            router.replace(ROUTES.home);
          }
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : "";
          setErrorMessage(getDeleteErrorMessage(code));
          // 다이얼로그는 열어둔 채로 유지 — 재시도 가능(500) 또는 원인 확인(403) 목적.
        },
      },
    );
  };

  return {
    isDialogOpen,
    requestDelete,
    confirmDelete,
    cancelDelete,
    isDeleting: mutation.isPending,
    errorMessage,
    successMessage,
  };
};
