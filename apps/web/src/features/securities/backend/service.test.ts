import { describe, expect, it, vi } from "vitest";
import { searchSecurities } from "@/features/securities/backend/service";
import { securitiesSearchErrorCodes } from "@/features/securities/backend/error";
import type {
  SecuritiesSearchByTextParams,
  SecuritiesSearchByTextResult,
  SecuritiesSearchRepository,
} from "@/features/securities/backend/repository";
import type { SecuritySearchQuery } from "@/features/securities/backend/schema";

const buildRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "11111111-1111-4111-8111-111111111111",
  ticker: "005930",
  name: "삼성전자",
  english_name: "Samsung Electronics",
  market: "KRX",
  listing_status: "listed",
  ...overrides,
});

const createRepository = (
  impl: (params: SecuritiesSearchByTextParams) => Promise<SecuritiesSearchByTextResult>,
): SecuritiesSearchRepository => ({
  searchByText: vi.fn(impl),
});

const baseQuery: SecuritySearchQuery = { q: "삼성", page: 1 };

describe("searchSecurities 서비스", () => {
  it("21행(20+hasMore용 1행) 반환 시 items.length=20, hasMore=true, pageSize=20", async () => {
    // Arrange
    const rows = Array.from({ length: 21 }, (_, i) => buildRow({ ticker: `T${i}`, name: `종목${i}` }));
    const repository = createRepository(async () => ({ ok: true, rows }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(20);
      expect(result.data.hasMore).toBe(true);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("5행 반환 시 items.length=5, hasMore=false", async () => {
    // Arrange
    const rows = Array.from({ length: 5 }, (_, i) => buildRow({ ticker: `T${i}`, name: `종목${i}` }));
    const repository = createRepository(async () => ({ ok: true, rows }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(5);
      expect(result.data.hasMore).toBe(false);
    }
  });

  it("0행 반환 시 items:[], hasMore=false, success(빈 결과는 오류 아님)", async () => {
    // Arrange
    const repository = createRepository(async () => ({ ok: true, rows: [] }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
      expect(result.data.hasMore).toBe(false);
    }
  });

  it("page=3이면 repository에 offset=40, limit=21을 전달한다", async () => {
    // Arrange
    let capturedParams: SecuritiesSearchByTextParams | undefined;
    const repository = createRepository(async (params) => {
      capturedParams = params;
      return { ok: true, rows: [] };
    });

    // Act
    await searchSecurities(repository, { q: "삼성", page: 3 });

    // Assert
    expect(capturedParams).toMatchObject({ offset: 40, limit: 21 });
  });

  it("전각 검색어는 정규화된 값으로 repository에 전달된다", async () => {
    // Arrange
    let capturedParams: SecuritiesSearchByTextParams | undefined;
    const repository = createRepository(async (params) => {
      capturedParams = params;
      return { ok: true, rows: [] };
    });

    // Act
    await searchSecurities(repository, { q: "　ＡＡＰＬ　", page: 1 });

    // Assert
    expect(capturedParams?.query).toBe("AAPL");
  });

  it("공백만 입력하면 400 INVALID_QUERY를 반환하고 repository를 호출하지 않는다", async () => {
    // Arrange
    const searchByText = vi.fn(async () => ({ ok: true as const, rows: [] }));
    const repository: SecuritiesSearchRepository = { searchByText };

    // Act
    const result = await searchSecurities(repository, { q: "   ", page: 1 });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(securitiesSearchErrorCodes.invalidQuery);
    }
    expect(searchByText).not.toHaveBeenCalled();
  });

  it("repository가 실패하면 500 SEARCH_FAILED를 반환한다", async () => {
    // Arrange
    const repository = createRepository(async () => ({ ok: false, message: "db down" }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(securitiesSearchErrorCodes.searchFailed);
    }
  });

  it("Row 스키마 위반(market: 'JP') 시 500 SEARCH_VALIDATION_ERROR를 반환한다", async () => {
    // Arrange
    const repository = createRepository(async () => ({
      ok: true,
      rows: [buildRow({ market: "JP" })],
    }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(securitiesSearchErrorCodes.validationError);
    }
  });

  it("snake_case → camelCase 매핑이 정확하다 (english_name:null, listing_status:'suspended')", async () => {
    // Arrange
    const repository = createRepository(async () => ({
      ok: true,
      rows: [buildRow({ english_name: null, listing_status: "suspended" })],
    }));

    // Act
    const result = await searchSecurities(repository, baseQuery);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0]).toMatchObject({
        englishName: null,
        listingStatus: "suspended",
      });
    }
  });

  it("market='KRX' 입력 시 repository에 market:'KRX', 미지정 시 null을 전달한다", async () => {
    // Arrange
    let capturedParams: SecuritiesSearchByTextParams | undefined;
    const repository = createRepository(async (params) => {
      capturedParams = params;
      return { ok: true, rows: [] };
    });

    // Act
    await searchSecurities(repository, { q: "삼성", page: 1, market: "KRX" });

    // Assert
    expect(capturedParams?.market).toBe("KRX");

    // Act (미지정)
    await searchSecurities(repository, { q: "삼성", page: 1 });

    // Assert
    expect(capturedParams?.market).toBe(null);
  });
});
