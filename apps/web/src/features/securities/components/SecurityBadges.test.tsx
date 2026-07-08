// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";

describe("MarketBadge", () => {
  it("market='KRX'는 KRX 배지를 렌더링한다", () => {
    render(<MarketBadge market="KRX" />);
    expect(screen.getByText("KRX")).toBeInTheDocument();
  });

  it("market='US'는 US 배지를 렌더링한다", () => {
    render(<MarketBadge market="US" />);
    expect(screen.getByText("US")).toBeInTheDocument();
  });
});

describe("ListingStatusBadge", () => {
  it("status='listed'는 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<ListingStatusBadge status="listed" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("status='suspended'는 '거래정지' 배지를 렌더링한다", () => {
    render(<ListingStatusBadge status="suspended" />);
    expect(screen.getByText("거래정지")).toBeInTheDocument();
  });

  it("status='delisted'는 '상장폐지' 배지를 렌더링한다", () => {
    render(<ListingStatusBadge status="delisted" />);
    expect(screen.getByText("상장폐지")).toBeInTheDocument();
  });
});
