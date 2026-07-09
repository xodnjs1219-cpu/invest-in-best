import { Button } from "@/components/ui";
import {
  MARKET_SELECT_KRX_LABEL,
  MARKET_SELECT_PROMPT_MESSAGE,
  MARKET_SELECT_US_LABEL,
} from "@/features/companies/constants";

type MarketSelectPromptProps = {
  onMarketSelect: (market: "KRX" | "US") => void;
};

/** E4 — 동일 티커 복수 시장 존재 시 시장 선택 유도. 로직 없는 Presenter. */
export function MarketSelectPrompt({ onMarketSelect }: MarketSelectPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius)] border border-border py-16 text-center">
      <p className="text-fg-muted">{MARKET_SELECT_PROMPT_MESSAGE}</p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => onMarketSelect("KRX")}>
          {MARKET_SELECT_KRX_LABEL}
        </Button>
        <Button variant="secondary" onClick={() => onMarketSelect("US")}>
          {MARKET_SELECT_US_LABEL}
        </Button>
      </div>
    </div>
  );
}
