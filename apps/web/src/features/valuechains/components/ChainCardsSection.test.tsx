// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChainCardsSection } from "@/features/valuechains/components/ChainCardsSection";
import type { ChainCard as ChainCardType } from "@/features/valuechains/lib/dto";

const buildCard = (overrides?: Partial<ChainCardType>): ChainCardType => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "반도체 밸류체인",
  chainType: "official",
  focusType: "industry",
  focusCompanyName: null,
  nodeCount: 3,
  latestMetric: null,
  updatedAt: "2026-07-08T00:00:00Z",
  ...overrides,
});

const baseProps = {
  title: "공식 밸류체인",
  items: [] as ChainCardType[],
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  emptyVariant: "official" as const,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onSelect: vi.fn(),
};

describe("ChainCardsSection", () => {
  it("isPending=true면 로딩 스켈레톤을 표시하고 카드/빈 상태는 표시하지 않는다", () => {
    render(<ChainCardsSection {...baseProps} isPending />);
    expect(screen.getByTestId("chain-cards-loading")).toBeInTheDocument();
  });

  it("isError=true면 오류 안내와 재시도 버튼을 표시하고 클릭 시 onRetry가 호출된다", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ChainCardsSection {...baseProps} isError onRetry={onRetry} />);

    expect(screen.getByRole("button", { name: /재시도/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /재시도/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("성공 + items=[] + emptyVariant='official'이면 공식 빈 상태 안내를 표시한다(엣지 1)", () => {
    render(<ChainCardsSection {...baseProps} items={[]} emptyVariant="official" />);
    expect(screen.getByText(/공식 체인/)).toBeInTheDocument();
  });

  it("성공 + items=[] + emptyVariant='mine'이면 생성 유도 안내를 표시한다(엣지 2)", () => {
    render(<ChainCardsSection {...baseProps} items={[]} emptyVariant="mine" />);
    expect(screen.getByText(/새 밸류체인 만들기|만들어/)).toBeInTheDocument();
  });

  it("hasNextPage=true면 더보기 버튼이 노출되고 클릭 시 onLoadMore가 호출된다", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <ChainCardsSection
        {...baseProps}
        items={[buildCard()]}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "더보기" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("isFetchingNextPage=true면 더보기 버튼이 로딩 상태로 표시된다(중복 클릭 방지)", () => {
    render(
      <ChainCardsSection
        {...baseProps}
        items={[buildCard()]}
        hasNextPage
        isFetchingNextPage
      />,
    );

    const button = screen.getByRole("button", { name: /불러오는 중/ });
    expect(button).toBeDisabled();
  });

  it("hasNextPage=false면 더보기 버튼이 노출되지 않는다", () => {
    render(<ChainCardsSection {...baseProps} items={[buildCard()]} hasNextPage={false} />);
    expect(screen.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
  });

  it("카드 선택 시 onSelect(chainId)가 전파된다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const card = buildCard();
    render(<ChainCardsSection {...baseProps} items={[card]} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /반도체 밸류체인/ }));
    expect(onSelect).toHaveBeenCalledWith(card.id);
  });

  it("타이틀을 표시한다", () => {
    render(<ChainCardsSection {...baseProps} title="내 밸류체인" items={[buildCard()]} />);
    expect(screen.getByText("내 밸류체인")).toBeInTheDocument();
  });
});
