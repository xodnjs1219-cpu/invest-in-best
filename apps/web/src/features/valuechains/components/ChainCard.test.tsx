// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChainCard } from "@/features/valuechains/components/ChainCard";
import type { ChainCard as ChainCardType } from "@/features/valuechains/lib/dto";

const buildCard = (overrides?: Partial<ChainCardType>): ChainCardType => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "반도체 밸류체인",
  chainType: "official",
  focusType: "company",
  focusCompanyName: "삼성전자",
  nodeCount: 3,
  latestMetric: {
    metricDate: "2026-07-08",
    totalMarketCapKrw: "123456789012",
    coveredNodeCount: 2,
    totalNodeCount: 3,
    isCarriedForward: false,
  },
  updatedAt: "2026-07-08T00:00:00Z",
  ...overrides,
});

describe("ChainCard", () => {
  it("정상 카드는 이름·기준·노드 수·가치총액·커버리지를 표시한다", () => {
    render(<ChainCard card={buildCard()} onSelect={vi.fn()} />);

    expect(screen.getByText("반도체 밸류체인")).toBeInTheDocument();
    expect(screen.getByText("기업 중심 · 삼성전자")).toBeInTheDocument();
    expect(screen.getByText("노드 3개")).toBeInTheDocument();
    expect(screen.getByText("1,234억원")).toBeInTheDocument();
    expect(screen.getByText("반영 2/전체 3")).toBeInTheDocument();
  });

  it("latestMetric이 null이면 가치총액 영역을 '0'과 다르게 미표시 처리한다", () => {
    render(<ChainCard card={buildCard({ latestMetric: null })} onSelect={vi.fn()} />);

    expect(screen.getByText(/집계 준비 중|미제공|-/)).toBeInTheDocument();
    expect(screen.queryByText("0원")).not.toBeInTheDocument();
  });

  it("isCarriedForward=true면 이월 표기를 추가로 표시한다", () => {
    const card = buildCard({
      latestMetric: {
        metricDate: "2026-07-08",
        totalMarketCapKrw: "1000",
        coveredNodeCount: 1,
        totalNodeCount: 1,
        isCarriedForward: true,
      },
    });
    render(<ChainCard card={card} onSelect={vi.fn()} />);

    expect(screen.getByText(/이월/)).toBeInTheDocument();
  });

  it("totalMarketCapKrw='0'이면 '0원'으로 값 표시한다(미표시 처리 아님)", () => {
    const card = buildCard({
      latestMetric: {
        metricDate: "2026-07-08",
        totalMarketCapKrw: "0",
        coveredNodeCount: 0,
        totalNodeCount: 2,
        isCarriedForward: false,
      },
    });
    render(<ChainCard card={card} onSelect={vi.fn()} />);

    expect(screen.getByText("0원")).toBeInTheDocument();
  });

  it("기업 중심 + 기업명 null이면 '기업 중심'만 표기한다", () => {
    render(<ChainCard card={buildCard({ focusCompanyName: null })} onSelect={vi.fn()} />);

    expect(screen.getByText("기업 중심")).toBeInTheDocument();
  });

  it("nodeCount=0이면 '노드 0개'로 정상 렌더링한다(엣지 9)", () => {
    render(<ChainCard card={buildCard({ nodeCount: 0 })} onSelect={vi.fn()} />);

    expect(screen.getByText("노드 0개")).toBeInTheDocument();
  });

  it("클릭 시 onSelect(chainId)가 1회 호출된다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const card = buildCard();
    render(<ChainCard card={card} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /반도체 밸류체인/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(card.id);
  });

  it("Enter 키 입력 시 onSelect(chainId)가 호출된다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const card = buildCard();
    render(<ChainCard card={card} onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: /반도체 밸류체인/ });
    button.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(card.id);
  });
});
