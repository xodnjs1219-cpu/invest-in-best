import { describe, expect, it, vi } from "vitest";
import { getRelationTypes } from "@/features/relation-types/backend/service";
import { relationTypeErrorCodes } from "@/features/relation-types/backend/error";
import type {
  FindAllRelationTypesFilter,
  FindAllRelationTypesResult,
  RelationTypeRepository,
} from "@/features/relation-types/backend/repository";

const buildRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "공급",
  is_directed: true,
  is_active: true,
  ...overrides,
});

const createRepository = (
  impl: (filter: FindAllRelationTypesFilter) => Promise<FindAllRelationTypesResult>,
): RelationTypeRepository => ({
  findAllRelationTypes: vi.fn(impl),
});

describe("getRelationTypes 서비스", () => {
  it("활성+비활성 혼재 rows → camelCase DTO 배열, isActive 보존", async () => {
    // Arrange
    const rows = [buildRow(), buildRow({ id: "22222222-2222-4222-8222-222222222222", name: "경쟁", is_directed: false, is_active: false })];
    const repository = createRepository(async () => ({ rows, error: null }));

    // Act
    const result = await getRelationTypes(repository, { activeOnly: false });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.relationTypes).toEqual([
        { id: rows[0]!.id, name: "공급", isDirected: true, isActive: true },
        { id: rows[1]!.id, name: "경쟁", isDirected: false, isActive: false },
      ]);
    }
  });

  it("activeOnly=true 전달 시 repository에 필터 위임", async () => {
    // Arrange
    const impl = vi.fn(async () => ({ rows: [], error: null }));
    const repository: RelationTypeRepository = { findAllRelationTypes: impl };

    // Act
    await getRelationTypes(repository, { activeOnly: true });

    // Assert
    expect(impl).toHaveBeenCalledWith({ activeOnly: true });
  });

  it("repository 오류 → failure(500, FETCH_FAILED)", async () => {
    // Arrange
    const repository = createRepository(async () => ({ rows: [], error: "db down" }));

    // Act
    const result = await getRelationTypes(repository, { activeOnly: false });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(relationTypeErrorCodes.fetchFailed);
    }
  });

  it("row 스키마 위반(is_directed 누락) → failure(500, VALIDATION_ERROR)", async () => {
    // Arrange
    const repository = createRepository(async () => ({ rows: [{ id: "x", name: "y" }], error: null }));

    // Act
    const result = await getRelationTypes(repository, { activeOnly: false });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(relationTypeErrorCodes.validationError);
    }
  });

  it("빈 목록 → success({ relationTypes: [] })", async () => {
    // Arrange
    const repository = createRepository(async () => ({ rows: [], error: null }));

    // Act
    const result = await getRelationTypes(repository, { activeOnly: false });

    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { relationTypes: [] } });
  });
});
