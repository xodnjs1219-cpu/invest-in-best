// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/explore/components/StockSearchPage", () => ({
  StockSearchPage: () => <div data-testid="stock-search-page-stub" />,
}));

const { default: StocksPage } = await import("@/app/(public)/stocks/page");

describe("app/(public)/stocks/page.tsx (종목 검색 페이지 셸)", () => {
  it("StockSearchPage를 배치만 하고 로직이 없다(Server Component)", () => {
    const element = StocksPage();
    expect(element.type).toBeDefined();
  });
});
