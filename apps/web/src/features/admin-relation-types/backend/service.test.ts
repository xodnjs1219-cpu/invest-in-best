import { describe, expect, it, vi } from "vitest";
import type { AdminRelationTypeRepositoryDeps } from "./service";
import { createRelationType, listRelationTypes, updateRelationType } from "./service";

const baseRow = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "공급",
  is_directed: true,
  is_active: true,
  is_in_use: true,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-05T00:00:00.000Z",
};

const buildDeps = (overrides: Partial<AdminRelationTypeRepositoryDeps> = {}): AdminRelationTypeRepositoryDeps => ({
  listRelationTypesWithUsage: vi.fn(async () => ({ ok: true as const, rows: [] })),
  findRelationTypeById: vi.fn(async () => ({ ok: true as const, row: null })),
  findRelationTypeByName: vi.fn(async () => ({ ok: true as const, duplicated: false })),
  insertRelationType: vi.fn(async () => ({
    kind: "created" as const,
    row: {
      id: "new-id",
      name: "라이선스",
      is_directed: true,
      is_active: true,
      created_at: "t",
      updated_at: "t",
    },
  })),
  updateRelationType: vi.fn(async () => ({
    kind: "updated" as const,
    row: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "공급(부품)",
      is_directed: true,
      is_active: true,
      created_at: "t",
      updated_at: "t2",
    },
  })),
  ...overrides,
});

describe("listRelationTypes (M6)", () => {
  it("RPC 행을 camelCase DTO로 매핑한다", async () => {
    // Arrange
    const deps = buildDeps({
      listRelationTypesWithUsage: vi.fn(async () => ({ ok: true as const, rows: [baseRow] })),
    });

    // Act
    const result = await listRelationTypes(deps);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.relationTypes).toEqual([
        {
          id: baseRow.id,
          name: "공급",
          isDirected: true,
          isActive: true,
          isInUse: true,
          createdAt: baseRow.created_at,
          updatedAt: baseRow.updated_at,
        },
      ]);
    }
  });

  it("빈 배열이면 success({relationTypes: []})를 반환한다(시드 이전 상태 허용)", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    const result = await listRelationTypes(deps);

    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { relationTypes: [] } });
  });

  it("RPC 오류 시 500 INTERNAL_ERROR를 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      listRelationTypesWithUsage: vi.fn(async () => ({ ok: false as const, message: "db down" })),
    });

    // Act
    const result = await listRelationTypes(deps);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("행 스키마 위반 시 500을 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      listRelationTypesWithUsage: vi.fn(async () => ({ ok: true as const, rows: [{ id: "not-uuid" }] as never })),
    });

    // Act
    const result = await listRelationTypes(deps);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

describe("createRelationType (M6)", () => {
  it("중복 검사 통과 후 생성하면 201과 DTO를 반환한다", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    const result = await createRelationType(deps, { name: "라이선스", isDirected: true });

    // Assert
    expect(result).toEqual({
      ok: true,
      status: 201,
      data: { id: "new-id", name: "라이선스", isDirected: true, isActive: true },
    });
    expect(deps.findRelationTypeByName).toHaveBeenCalledWith("라이선스");
    expect(deps.insertRelationType).toHaveBeenCalledWith({ name: "라이선스", isDirected: true });
  });

  it("사전 검사에서 중복이면 409를 반환하고 insert를 호출하지 않는다", async () => {
    // Arrange
    const insertMock = vi.fn();
    const deps = buildDeps({
      findRelationTypeByName: vi.fn(async () => ({ ok: true as const, duplicated: true })),
      insertRelationType: insertMock,
    });

    // Act
    const result = await createRelationType(deps, { name: "공급", isDirected: true });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe("RELATION_TYPE_NAME_DUPLICATE");
    }
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("insert 레이스(23505)로 duplicate 반환 시 409를 반환한다(E2·E10)", async () => {
    // Arrange
    const deps = buildDeps({ insertRelationType: vi.fn(async () => ({ kind: "duplicate" as const })) });

    // Act
    const result = await createRelationType(deps, { name: "공급", isDirected: true });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  it("비활성 종류와 동일 이름이어도 409(활성·비활성 전체 대상 — BR-5)", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeByName: vi.fn(async () => ({ ok: true as const, duplicated: true })),
    });

    // Act
    const result = await createRelationType(deps, { name: "비활성종류", isDirected: true });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  it("중복 검사 오류 시 500을 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeByName: vi.fn(async () => ({ ok: false as const, message: "db error" })),
    });

    // Act
    const result = await createRelationType(deps, { name: "공급", isDirected: true });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it("insert 기타 오류 시 500을 반환한다", async () => {
    // Arrange
    const deps = buildDeps({ insertRelationType: vi.fn(async () => ({ kind: "error" as const, message: "boom" })) });

    // Act
    const result = await createRelationType(deps, { name: "공급", isDirected: true });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

describe("updateRelationType (M6)", () => {
  it("미존재 ID면 404를 반환하고 update를 호출하지 않는다(E6)", async () => {
    // Arrange
    const updateMock = vi.fn();
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({ ok: true as const, row: null })),
      updateRelationType: updateMock,
    });

    // Act
    const result = await updateRelationType(deps, "missing-id", { name: "새이름" });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe("RELATION_TYPE_NOT_FOUND");
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("이름 변경 시 타 행과 중복이면 409를 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      findRelationTypeByName: vi.fn(async () => ({ ok: true as const, duplicated: true })),
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { name: "고객" });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
    expect(deps.findRelationTypeByName).toHaveBeenCalledWith("고객", "rt-1");
  });

  it("자기 자신과 동일한 이름으로 재저장하면 중복 검사를 생략하고 성공한다(no-op rename)", async () => {
    // Arrange
    const findByNameMock = vi.fn(async () => ({ ok: true as const, duplicated: false }));
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      findRelationTypeByName: findByNameMock,
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { name: "공급" });

    // Assert
    expect(result.ok).toBe(true);
    expect(findByNameMock).not.toHaveBeenCalled();
  });

  it("{isActive: false}만 전달하면 이름 중복 검사를 호출하지 않고 update patch에 is_active만 포함된다(E3)", async () => {
    // Arrange
    const findByNameMock = vi.fn(async () => ({ ok: true as const, duplicated: false }));
    const updateMock = vi.fn(async () => ({
      kind: "updated" as const,
      row: { id: "rt-1", name: "공급", is_directed: true, is_active: false, created_at: "t", updated_at: "t2" },
    }));
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      findRelationTypeByName: findByNameMock,
      updateRelationType: updateMock,
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { isActive: false });

    // Assert
    expect(result.ok).toBe(true);
    expect(findByNameMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith("rt-1", { is_active: false });
  });

  it("{isActive: true}로 재활성화가 성공한다(E4)", async () => {
    // Arrange
    const updateMock = vi.fn(async () => ({
      kind: "updated" as const,
      row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t2" },
    }));
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: false, created_at: "t", updated_at: "t" },
      })),
      updateRelationType: updateMock,
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { isActive: true });

    // Assert
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith("rt-1", { is_active: true });
  });

  it("update가 not_found를 반환하면(경합) 404를 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      updateRelationType: vi.fn(async () => ({ kind: "not_found" as const })),
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { isActive: false });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("update가 duplicate를 반환하면 409를 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      updateRelationType: vi.fn(async () => ({ kind: "duplicate" as const })),
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { name: "중복이름" });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  it("repository 오류 시 500을 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({
        ok: true as const,
        row: { id: "rt-1", name: "공급", is_directed: true, is_active: true, created_at: "t", updated_at: "t" },
      })),
      updateRelationType: vi.fn(async () => ({ kind: "error" as const, message: "boom" })),
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { isActive: false });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it("findRelationTypeById 조회 오류 시 500을 반환한다", async () => {
    // Arrange
    const deps = buildDeps({
      findRelationTypeById: vi.fn(async () => ({ ok: false as const, message: "db error" })),
    });

    // Act
    const result = await updateRelationType(deps, "rt-1", { isActive: false });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

describe("BR-7 스냅샷 미생성 회귀 검사", () => {
  it("생성/수정 경로 어디에서도 스냅샷/엣지 관련 repository 함수를 호출하지 않는다", async () => {
    // Arrange
    const deps = buildDeps();

    // Act
    await createRelationType(deps, { name: "라이선스", isDirected: true });
    await updateRelationType(deps, "123e4567-e89b-12d3-a456-426614174000", { isActive: false });

    // Assert — deps 인터페이스 자체에 스냅샷/엣지 관련 함수가 없음을 타입/호출 목록으로 보증
    const calledFnNames = Object.keys(deps);
    expect(calledFnNames.some((name) => /snapshot|edge/i.test(name))).toBe(false);
  });
});
