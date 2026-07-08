import { describe, expect, it, vi } from "vitest";
import { createRelationTypeRepository } from "@/features/relation-types/backend/repository";

type SelectResult = { data: unknown[] | null; error: { message: string } | null };

const createSupabaseSelectMock = (result: SelectResult) => {
  const order = vi.fn(async () => result);
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq, order }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, select, eq, order };
};

describe("createRelationTypeRepository.findAllRelationTypes", () => {
  it("activeOnly=false → is_active 필터 없이 전체 조회", async () => {
    // Arrange
    const { client, eq, order } = createSupabaseSelectMock({ data: [], error: null });
    const repository = createRelationTypeRepository(client as never);

    // Act
    await repository.findAllRelationTypes({ activeOnly: false });

    // Assert
    expect(eq).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("activeOnly=true → is_active=true 필터 적용", async () => {
    // Arrange
    const { client, eq } = createSupabaseSelectMock({ data: [], error: null });
    const repository = createRelationTypeRepository(client as never);

    // Act
    await repository.findAllRelationTypes({ activeOnly: true });

    // Assert
    expect(eq).toHaveBeenCalledWith("is_active", true);
  });

  it("Supabase 오류 응답 → { rows: [], error: message } 반환(throw 없음)", async () => {
    // Arrange
    const { client } = createSupabaseSelectMock({ data: null, error: { message: "db down" } });
    const repository = createRelationTypeRepository(client as never);

    // Act
    const result = await repository.findAllRelationTypes({ activeOnly: false });

    // Assert
    expect(result).toEqual({ rows: [], error: "db down" });
  });

  it("정상 조회 → { rows: data, error: null } 반환", async () => {
    // Arrange
    const rows = [{ id: "rt1", name: "공급", is_directed: true, is_active: true }];
    const { client } = createSupabaseSelectMock({ data: rows, error: null });
    const repository = createRelationTypeRepository(client as never);

    // Act
    const result = await repository.findAllRelationTypes({ activeOnly: false });

    // Assert
    expect(result).toEqual({ rows, error: null });
  });
});
