/**
 * Phase 0 — 종목 마스터 시드·보강 (docs/usecases/031/plan.md 모듈 15).
 * corpCode.xml(KRX)+company_tickers.json(US) 시드, 토스 stocks 200청크 보강(toss_symbol·주식수), H-5 준수.
 * 완료 체크포인트면 스킵. 재개 시 cursor.step부터 이어서 진행(dart/sec 재호출 없음).
 */
import { TOSS_SYMBOLS_CHUNK_SIZE, isSpacName } from "@iib/domain";
import type { CorpCodeMapping } from "../../adapters/opendart/contract";
import type { SecTickerEntry } from "../../adapters/sec-edgar/contract";
import type { NormalizedStockDetail } from "../../adapters/tossinvest/contract";
import type { RepoResult } from "../../repositories/result";
import type { SecurityTickerRow, SecuritySeedRow } from "../../repositories/securities.repository";
import type { SharesRow } from "../../repositories/shares.repository";
import { PHASE0_SEED_CHECKPOINT_KEY, parsePhase0Cursor, phase0InitialCursor, type Phase0Cursor } from "./checkpoint-plan";

export interface Phase0DartPort {
  fetchCorpCodeMappings(): Promise<CorpCodeMapping[]>;
}

export interface Phase0SecPort {
  fetchTickerCikMap(): Promise<SecTickerEntry[]>;
}

export interface Phase0TossPort {
  getStocks(symbols: string[]): Promise<{ stocks: NormalizedStockDetail[]; failures: unknown[]; carriedOverSymbols: string[] }>;
}

export interface Phase0Repos {
  upsertSecuritySeeds(rows: SecuritySeedRow[]): Promise<RepoResult<void>>;
  upsertShares(rows: SharesRow[]): Promise<RepoResult<void>>;
  findAllTickers(): Promise<RepoResult<SecurityTickerRow[]>>;
}

export interface Phase0Checkpoints {
  get(key: string): Promise<RepoResult<{ cursor: unknown; isCompleted: boolean } | null>>;
  upsert(key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(key: string): Promise<RepoResult<void>>;
}

export interface Phase0Guard {
  waitUntilIdle(runId: string): Promise<void>;
}

export interface Phase0Deps {
  dart: Phase0DartPort;
  sec: Phase0SecPort;
  toss: Phase0TossPort;
  repos: Phase0Repos;
  checkpoints: Phase0Checkpoints;
  guard: Phase0Guard;
}

export interface Phase0Summary {
  processed: number;
  skipped: boolean;
}

export interface Phase0Job {
  run(runId?: string): Promise<Phase0Summary>;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function createPhase0SeedSecurities(deps: Phase0Deps): Phase0Job {
  const { dart, sec, toss, repos, checkpoints, guard } = deps;

  return {
    async run(runId = "backfill"): Promise<Phase0Summary> {
      let processed = 0;

      const existing = await checkpoints.get(PHASE0_SEED_CHECKPOINT_KEY);
      if (existing.ok && existing.data?.isCompleted) {
        return { processed: 0, skipped: true };
      }

      let cursor: Phase0Cursor = existing.ok && existing.data ? parsePhase0Cursor(existing.data.cursor) : phase0InitialCursor();

      await guard.waitUntilIdle(runId);

      // [dart] KRX 상장 법인 전체 매핑 — 1회 호출.
      if (cursor.step === "dart") {
        const mappings = await dart.fetchCorpCodeMappings();
        // 스팩(기업인수목적회사)은 실체 사업이 없어 분석 대상에서 제외 — 시드 단계에서 걸러낸다.
        const nonSpacMappings = mappings.filter((m) => !isSpacName(m.corpName));
        if (nonSpacMappings.length > 0) {
          const rows: SecuritySeedRow[] = nonSpacMappings.map((m) => ({
            market: "KRX" as const,
            ticker: m.stockCode,
            name: m.corpName,
            currency: "KRW" as const,
            dartCorpCode: m.corpCode,
          }));
          const dartResult = await repos.upsertSecuritySeeds(rows);
          if (!dartResult.ok) console.error(`[phase0/dart] upsertSecuritySeeds 실패: ${dartResult.error}`);
          processed += rows.length;
        }
        cursor = { step: "sec", tossChunkIndex: 0 };
        await checkpoints.upsert(PHASE0_SEED_CHECKPOINT_KEY, cursor, false);
      }

      await guard.waitUntilIdle(runId);

      // [sec] US 티커-CIK 전체 맵 — 1회 호출. SEC 전체를 마스터로 유지(H-5).
      if (cursor.step === "sec") {
        const entries = await sec.fetchTickerCikMap();
        // 스팩 상호 패턴은 시드 단계에서 제외(한국 상호 관례 기반 — 미국 SPAC은 대부분 잡히지 않으나 보수적으로 적용).
        const nonSpacEntries = entries.filter((e) => !isSpacName(e.title));
        if (nonSpacEntries.length > 0) {
          const rows: SecuritySeedRow[] = nonSpacEntries.map((e) => ({
            market: "US" as const,
            ticker: e.ticker,
            name: e.title,
            englishName: e.title,
            currency: "USD" as const,
            cik: e.cik,
          }));
          const secResult = await repos.upsertSecuritySeeds(rows);
          if (!secResult.ok) console.error(`[phase0/sec] upsertSecuritySeeds 실패: ${secResult.error}`);
          processed += rows.length;
        }
        cursor = { step: "toss", tossChunkIndex: 0 };
        await checkpoints.upsert(PHASE0_SEED_CHECKPOINT_KEY, cursor, false);
      }

      // [toss] 전 종목 ticker를 200개 청크로 순회해 toss_symbol 확정 + 정형 필드 보강.
      if (cursor.step === "toss") {
        const tickersResult = await repos.findAllTickers();
        const allTickers = tickersResult.ok ? tickersResult.data : [];
        // ticker는 시장별로 유일하지 않을 수 있으나(KRX 6자리 숫자 vs US 알파벳 티커는 실질적으로 겹치지 않음),
        // securities 스키마상 (market,ticker)가 유니크 키다. toss 응답은 market을 주지 않으므로
        // 마스터에 이미 존재하는 (ticker -> {id, market}) 매핑을 신뢰해 정확한 market으로 UPSERT한다.
        const byTicker = new Map(allTickers.map((t) => [t.ticker, t]));
        const chunks = chunkArray(
          allTickers.map((t) => t.ticker),
          TOSS_SYMBOLS_CHUNK_SIZE,
        );

        for (let i = cursor.tossChunkIndex; i < chunks.length; i++) {
          await guard.waitUntilIdle(runId);
          const chunkSymbols = chunks[i]!;
          const result = await toss.getStocks(chunkSymbols);

          // 스팩은 시드 대상이 아니다. 토스는 한글명("A 스팩 애퀴지션")·영문명을 모두 주므로
          // 둘 중 하나라도 스팩이면 제외 — sec 시드에서 놓친 잔존 스팩이 여기서 되살아나는 것을 막는다.
          const matched = result.stocks.filter(
            (s) => byTicker.has(s.symbol) && !isSpacName(s.name) && !isSpacName(s.englishName),
          );
          if (matched.length > 0) {
            const seedRows: SecuritySeedRow[] = matched.map((s) => {
              const market = byTicker.get(s.symbol)!.market;
              return {
                market,
                ticker: s.symbol,
                // currency는 securities NOT NULL 컬럼 — UPSERT가 INSERT 경로로 NOT NULL을 검사하므로
                // 부분 payload라도 반드시 채운다(market 1:1 결정: KRX=KRW, US=USD).
                currency: market === "KRX" ? ("KRW" as const) : ("USD" as const),
                tossSymbol: s.symbol,
                name: s.name,
                englishName: s.englishName ?? undefined,
                isinCode: s.isinCode ?? undefined,
                securityType: s.securityType ?? undefined,
                listDate: s.listDate,
                delistDate: s.delistDate,
              };
            });
            const seedResult = await repos.upsertSecuritySeeds(seedRows);
            if (!seedResult.ok) {
              // 숨은 실패 방지 — 이전에는 반환값을 무시해 toss_symbol 미반영이 조용히 넘어갔다.
              console.error(`[phase0/toss] upsertSecuritySeeds 실패 (chunk ${i}): ${seedResult.error}`);
            }
            processed += seedRows.length;

            const sharesRows: SharesRow[] = matched
              .filter((s) => s.sharesOutstanding !== null)
              .map((s) => ({
                securityId: byTicker.get(s.symbol)!.id,
                shares: s.sharesOutstanding!,
                asOfDate: new Date().toISOString().slice(0, 10),
                source: "toss" as const,
                sourceTag: null,
                isMultiClassPartial: false,
              }));
            if (sharesRows.length > 0) {
              await repos.upsertShares(sharesRows);
            }
          }

          cursor = { step: "toss", tossChunkIndex: i + 1 };
          await checkpoints.upsert(PHASE0_SEED_CHECKPOINT_KEY, cursor, false);
        }
      }

      await checkpoints.complete(PHASE0_SEED_CHECKPOINT_KEY);
      return { processed, skipped: false };
    },
  };
}
