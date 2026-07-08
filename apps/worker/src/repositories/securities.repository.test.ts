import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findAllForFinancials, findCollectTargets, flagSharesManualOverride, updateDartCorpCodes } from "./securities.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findCollectTargets", () => {
  it("applies market IN, listing_status='listed', and toss_symbol NOT NULL filters", async () => {
    const notFn = vi.fn().mockResolvedValue({
      data: [{ id: "sec-1", toss_symbol: "005930", market: "KRX", currency: "KRW" }],
      error: null,
    });
    const eqFn = vi.fn().mockReturnValue({ not: notFn });
    const inFn = vi.fn().mockReturnValue({ eq: eqFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findCollectTargets(client, ["KRX"]);

    expect(from).toHaveBeenCalledWith("securities");
    expect(inFn).toHaveBeenCalledWith("market", ["KRX"]);
    expect(eqFn).toHaveBeenCalledWith("listing_status", "listed");
    expect(notFn).toHaveBeenCalledWith("toss_symbol", "is", null);
    expect(result).toEqual({
      ok: true,
      data: [{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }],
    });
  });
});

describe("findAllForFinancials", () => {
  it("excludes delisted securities but includes suspended ones (E20), selecting mapping columns", async () => {
    const neqFn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "sec-1",
          ticker: "005930",
          market: "KRX",
          listing_status: "listed",
          dart_corp_code: "00126380",
          cik: null,
          toss_symbol: "005930",
          shares_manual_override_needed: false,
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ neq: neqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findAllForFinancials(client);

    expect(from).toHaveBeenCalledWith("securities");
    expect(neqFn).toHaveBeenCalledWith("listing_status", "delisted");
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "sec-1",
          ticker: "005930",
          market: "KRX",
          listingStatus: "listed",
          dartCorpCode: "00126380",
          cik: null,
          tossSymbol: "005930",
          sharesManualOverrideNeeded: false,
        },
      ],
    });
  });
});

describe("updateDartCorpCodes", () => {
  it("updates dart_corp_code for each ticker individually", async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await updateDartCorpCodes(client, [{ ticker: "005930", dartCorpCode: "00126380" }]);

    expect(from).toHaveBeenCalledWith("securities");
    expect(update).toHaveBeenCalledWith({ dart_corp_code: "00126380" });
    expect(eqFn).toHaveBeenCalledWith("ticker", "005930");
    expect(result.ok).toBe(true);
  });

  it("is a no-op success for an empty list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await updateDartCorpCodes(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe("flagSharesManualOverride", () => {
  it("sets shares_manual_override_needed=true for the given ids", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await flagSharesManualOverride(client, ["sec-1", "sec-2"]);

    expect(update).toHaveBeenCalledWith({ shares_manual_override_needed: true });
    expect(inFn).toHaveBeenCalledWith("id", ["sec-1", "sec-2"]);
    expect(result.ok).toBe(true);
  });

  it("is a no-op success for an empty id list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await flagSharesManualOverride(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
