import { Button, Heading } from "@/components/ui";

/**
 * 체인 상한 진입 차단 화면 (UC-013 plan 모듈 17, E2).
 * 순수 Presenter — 상수를 직접 참조하지 않고 호출측(ChainEditorPage)이 게이트 결과를 props로 전달한다.
 */
export interface EntryBlockedScreenProps {
  ownedChainCount: number;
  maxChainsPerUser: number;
}

export function EntryBlockedScreen({ ownedChainCount, maxChainsPerUser }: EntryBlockedScreenProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <Heading level={1}>밸류체인 생성 상한 도달</Heading>
      <p className="text-sm text-fg-muted">
        1인당 만들 수 있는 밸류체인은 최대 {maxChainsPerUser}개입니다. 현재{" "}
        {maxChainsPerUser}개 중 {ownedChainCount}개를 사용 중이라 더 이상 새 밸류체인을 만들 수
        없습니다.
      </p>
      <p className="text-sm text-fg-muted">
        기존 밸류체인을 삭제하면 새로 만들 수 있습니다.
      </p>
      <Button as="link" href="/">
        내 밸류체인 목록으로 이동
      </Button>
    </div>
  );
}
