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
    <div className="flex flex-col items-center gap-4 rounded-md border border-gray-200 py-16 text-center">
      <p className="text-gray-700">{MARKET_SELECT_PROMPT_MESSAGE}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onMarketSelect("KRX")}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {MARKET_SELECT_KRX_LABEL}
        </button>
        <button
          type="button"
          onClick={() => onMarketSelect("US")}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          {MARKET_SELECT_US_LABEL}
        </button>
      </div>
    </div>
  );
}
