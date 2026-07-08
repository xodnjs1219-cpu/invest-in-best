"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { useCloneChain } from "@/features/valuechains/hooks/useCloneChain";
import { getCloneErrorMessage, CLONE_SUCCESS_MESSAGE } from "@/features/valuechains/constants/clone";
import { ApiError } from "@/lib/http/api-client";

const LOGIN_PATH = "/auth/login";

const buildLoginRedirect = (returnTo: string): string =>
  `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`;

const buildEditPath = (chainId: string): string => `/valuechains/${chainId}/edit`;

export type CloneChainActionResult = {
  requestClone: () => void;
  isCloning: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

/**
 * 복제 액션 훅(Container 로직, UC-014 plan 모듈 12).
 * 로그인 확인→로그인 유도(returnTo)→mutation 실행→성공 시 편집 캔버스 라우팅(D-3)→
 * 에러 코드별 안내 메시지 매핑까지 담당한다. chain-view Flux Store에는 Action을 추가하지 않는다
 * (서버 상태 변이는 mutation으로 처리, 라우팅/메시지는 이 훅의 로컬 상태).
 */
export const useCloneChainAction = (chainId: string): CloneChainActionResult => {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useCurrentUser();
  const mutation = useCloneChain();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestClone = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (status !== "authenticated") {
      router.push(buildLoginRedirect(pathname ?? "/"));
      return;
    }

    mutation.mutate(
      { chainId },
      {
        onSuccess: (data) => {
          setSuccessMessage(CLONE_SUCCESS_MESSAGE);
          router.push(buildEditPath(data.chainId));
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) {
            router.push(buildLoginRedirect(pathname ?? "/"));
            return;
          }
          const code = error instanceof ApiError ? error.code : "";
          setErrorMessage(getCloneErrorMessage(code));
        },
      },
    );
  };

  return {
    requestClone,
    isCloning: mutation.isPending,
    errorMessage,
    successMessage,
  };
};
