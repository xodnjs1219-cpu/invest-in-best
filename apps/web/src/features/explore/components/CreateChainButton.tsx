"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const NEW_CHAIN_PATH = "/valuechains/new";
const LOGIN_PATH = "/auth/login";

type CreateChainButtonProps = {
  isAuthenticated: boolean;
};

/**
 * "새 밸류체인 만들기" 진입점 (UC-007 plan 모듈 D-6).
 * 로그인 상태면 생성 페이지로, 비로그인이면 로그인 페이지로 `returnTo`와 함께 유도한다
 * (로그인 후 원래 목적지 복귀 — UC-002/003 연계, 엣지 10). 내비게이션 사이드이펙트만 있고
 * 별도 상태/Action은 없다(state_management §4).
 */
export function CreateChainButton({ isAuthenticated }: CreateChainButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (isAuthenticated) {
      router.push(NEW_CHAIN_PATH);
      return;
    }
    router.push(`${LOGIN_PATH}?returnTo=${encodeURIComponent(NEW_CHAIN_PATH)}`);
  };

  return (
    <Button variant="primary" onClick={handleClick}>
      새 밸류체인 만들기
    </Button>
  );
}
