/**
 * 토스 어댑터 계약 (docs/usecases/026/plan.md 모듈 11).
 * 잡이 의존하는 유일한 어댑터 표면 — HTTP/Zod 구현 세부는 client.ts/dto.ts에 격리한다(techstack §4·§8).
 */
import type { MarketCode } from "@iib/domain";

/** 내부 정규화 시세 모델 — 외부 DTO(dto.ts)와 분리. */
export interface NormalizedQuote {
  symbol: string;
  price: number;
  volume: number | null;
  currency: string;
}

/** 내부 정규화 확정 일봉 모델. */
export interface NormalizedDailyCandle {
  symbol: string;
  /** 시장 현지 일자(yyyy-MM-dd) — market-session.resolveLocalDate 기준. */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export type SymbolFailureReason = "not_found" | "validation_failed" | "request_failed";

export interface SymbolFailure {
  symbol: string;
  reason: SymbolFailureReason;
  message: string;
}

export interface GetPricesResult {
  quotes: NormalizedQuote[];
  failures: SymbolFailure[];
  /** 지속 429 등으로 포기·이월된 심볼(E3) — 다음 실행에서 자연 재포함. */
  carriedOverSymbols: string[];
}

/** 내부 정규화 종목 정보 모델 — UC-027(collect-financials)의 토스 상장주식수 1순위 소스. */
export interface NormalizedStockInfo {
  symbol: string;
  sharesOutstanding: number | null;
  status: string;
  name: string;
}

export interface GetStockInfosResult {
  infos: NormalizedStockInfo[];
  failures: SymbolFailure[];
  carriedOverSymbols: string[];
}

/**
 * 내부 정규화 환율 모델(UC-028 모듈 3) — `1 base = rate quote`(0009 컬럼 주석).
 * base/quote는 항상 FX_PAIR(USD/KRW) 방향으로 정규화된다.
 */
export interface NormalizedFxRate {
  baseCurrency: "USD";
  quoteCurrency: "KRW";
  rate: number;
  rateDate: string;
}

export type GetExchangeRateResult = { kind: "ok"; rate: NormalizedFxRate } | { kind: "not_published" };

/**
 * 내부 정규화 장 운영 캘린더 1일자 모델(UC-028 모듈 3).
 * 휴장일은 openAt/closeAt이 null(0009 스키마), 정규장 세션 기준 단일 구간.
 */
export interface NormalizedCalendarDay {
  market: MarketCode;
  calendarDate: string;
  isTradingDay: boolean;
  openAt: Date | null;
  closeAt: Date | null;
  isEarlyClose: boolean;
}

/**
 * 토스증권 Open API 포트. 잡 로직은 이 인터페이스에만 의존한다.
 * UC-028(exchange-rate/market-calendar)·UC-031(stocks/candles 페이지네이션) 메서드는
 * 후속 plan이 이 인터페이스에 추가한다(계약 파일 공유, 심볼 충돌 없음).
 */
export interface TossInvestPort {
  /** 청크 분할·부분 실패 분리는 구현 책임(client.ts). */
  getPrices(symbols: string[]): Promise<GetPricesResult>;

  /**
   * 해당 일자의 확정 일봉. 없거나 아직 미발행이면 null(오류 아님 — E10, 재시도 대상 유지).
   * 종목 자체가 없으면(stock-not-found) TossRequestError를 throw한다(재시도 없음).
   * market은 캔들 timestamp를 현지 일자로 변환할 타임존을 결정한다(KRX/US 혼용 방지).
   */
  getConfirmedDailyCandle(
    symbol: string,
    localDate: string,
    market: MarketCode,
  ): Promise<NormalizedDailyCandle | null>;

  /**
   * 종목 기본 정보(발행주식수 포함, UC-027 모듈 11). 200개 청크 순회·부분 실패 분리는 구현 책임(client.ts).
   */
  getStockInfos(symbols: string[]): Promise<GetStockInfosResult>;

  /**
   * KRW↔USD 환율(UC-028 모듈 3). 404(exchange-rate-not-found)는 오류가 아닌 `not_published`
   * (공휴일 등 당일 결측 정상 흐름). 그 외 최종 실패는 TossRequestError를 throw한다.
   */
  getExchangeRate(now: Date): Promise<GetExchangeRateResult>;

  /**
   * 시장별 장 운영 캘린더(UC-028 모듈 3). 응답이 제공하는 일자(당일·익일)를 모두 정규화해 반환한다.
   * 검증·시각 변환 실패는 TossRequestError(비재시도)로 throw한다.
   */
  getMarketCalendar(market: MarketCode, now: Date): Promise<NormalizedCalendarDay[]>;
}

/** 토큰 발급/재발급 최종 실패 — 잡 전체 failed 신호(E5). */
export class TossAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TossAuthError";
  }
}

/** 요청 단위 오류(4xx/5xx) — code/status/재시도 대기시간을 담아 재시도 판정에 활용. */
export class TossRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(params: { code: string; status: number; message: string; retryAfterMs?: number }) {
    super(params.message);
    this.name = "TossRequestError";
    this.code = params.code;
    this.status = params.status;
    this.retryAfterMs = params.retryAfterMs;
  }
}
