// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MarketSelectPrompt } from "@/features/companies/components/MarketSelectPrompt";

describe("MarketSelectPrompt", () => {
  it("KRX 버튼 클릭 시 onMarketSelect('KRX')가 1회 호출된다", async () => {
    const user = userEvent.setup();
    const onMarketSelect = vi.fn();
    render(<MarketSelectPrompt onMarketSelect={onMarketSelect} />);

    await user.click(screen.getByRole("button", { name: /한국거래소/ }));

    expect(onMarketSelect).toHaveBeenCalledTimes(1);
    expect(onMarketSelect).toHaveBeenCalledWith("KRX");
  });

  it("US 버튼 클릭 시 onMarketSelect('US')가 호출된다", async () => {
    const user = userEvent.setup();
    const onMarketSelect = vi.fn();
    render(<MarketSelectPrompt onMarketSelect={onMarketSelect} />);

    await user.click(screen.getByRole("button", { name: /미국/ }));

    expect(onMarketSelect).toHaveBeenCalledWith("US");
  });
});
