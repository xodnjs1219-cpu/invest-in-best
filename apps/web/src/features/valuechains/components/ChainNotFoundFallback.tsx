import { Button, EmptyState } from "@/components/ui";

/**
 * 체인 없음 폴백 (plan 모듈 C6) — E1·E12·C-2 공용. 재시도 버튼 없음(존재하지 않음이 재시도로
 * 해결되지 않는 상태이므로). 메인(`/`) 이동 버튼만 제공한다.
 */
export const ChainNotFoundFallback = () => {
  return (
    <EmptyState
      message={
        <>
          <span className="block text-base font-medium text-fg">체인을 찾을 수 없습니다.</span>
          <span className="mt-1 block text-sm text-fg-muted">
            요청하신 밸류체인이 존재하지 않거나 접근할 수 없습니다.
          </span>
        </>
      }
    >
      <Button as="link" href="/">
        메인으로 이동
      </Button>
    </EmptyState>
  );
};
