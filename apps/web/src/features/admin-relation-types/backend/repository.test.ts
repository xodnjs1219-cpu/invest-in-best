import { describe, expect, it, vi } from "vitest";
import {
  findRelationTypeById,
  findRelationTypeByName,
  insertRelationType,
  listRelationTypesWithUsage,
  updateRelationType,
} from "./repository";

describe("listRelationTypesWithUsage (M5)", () => {
  it("admin_list_relation_types를 파라미터 없이 rpc 호출한다", async () => {
    // Arrange
    const rows = [{ id: "rt-1", name: "공급" }];
    const rpcMock = vi.fn(async () => ({ data: rows, error: null }));
    const client = { rpc: rpcMock };

    // Act
    const result = await listRelationTypesWithUsage(client as never);

    // Assert
    expect(result).toEqual({ ok: true, rows });
    expect(rpcMock).toHaveBeenCalledWith("admin_list_relation_types");
  });

  it("rpc 오류 시 {ok:false}를 반환한다(throw 없음)", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "db error" } })) };

    // Act
    const result = await listRelationTypesWithUsage(client as never);

    // Assert
    expect(result).toEqual({ ok: false, message: "db error" });
  });

  it("data가 null이면 빈 배열로 취급한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: null })) };

    // Act
    const result = await listRelationTypesWithUsage(client as never);

    // Assert
    expect(result).toEqual({ ok: true, rows: [] });
  });
});

describe("findRelationTypeById (M5)", () => {
  it("id로 단건 조회한다", async () => {
    // Arrange
    const row = { id: "rt-1", name: "공급" };
    const maybeSingleMock = vi.fn(async () => ({ data: row, error: null }));
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ select: selectMock })) };

    // Act
    const result = await findRelationTypeById(client as never, "rt-1");

    // Assert
    expect(result).toEqual({ ok: true, row });
    expect(eqMock).toHaveBeenCalledWith("id", "rt-1");
  });

  it("행이 없으면 {ok:true, row:null}을 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
      })),
    };

    // Act
    const result = await findRelationTypeById(client as never, "rt-missing");

    // Assert
    expect(result).toEqual({ ok: true, row: null });
  });

  it("조회 오류 시 {ok:false}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: { message: "db error" } })) })),
        })),
      })),
    };

    // Act
    const result = await findRelationTypeById(client as never, "rt-1");

    // Assert
    expect(result).toEqual({ ok: false, message: "db error" });
  });
});

describe("findRelationTypeByName (M5)", () => {
  it("excludeId 없이 이름만으로 조회한다(중복 없음)", async () => {
    // Arrange
    const eqMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ select: selectMock })) };

    // Act
    const result = await findRelationTypeByName(client as never, "공급");

    // Assert
    expect(result).toEqual({ ok: true, duplicated: false });
    expect(eqMock).toHaveBeenCalledWith("name", "공급");
  });

  it("이름이 이미 존재하면 duplicated:true를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [{ id: "rt-1" }], error: null })) })),
      })),
    };

    // Act
    const result = await findRelationTypeByName(client as never, "공급");

    // Assert
    expect(result).toEqual({ ok: true, duplicated: true });
  });

  it("excludeId 지정 시 .neq('id', excludeId) 조건이 포함된다(자기 이름 재저장 허용의 핵심)", async () => {
    // Arrange
    const neqMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
    const eqMock = vi.fn(() => ({ neq: neqMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ select: selectMock })) };

    // Act
    const result = await findRelationTypeByName(client as never, "공급", "rt-1");

    // Assert
    expect(result).toEqual({ ok: true, duplicated: false });
    expect(eqMock).toHaveBeenCalledWith("name", "공급");
    expect(neqMock).toHaveBeenCalledWith("id", "rt-1");
  });

  it("조회 오류 시 {ok:false}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: { message: "db error" } })) })),
      })),
    };

    // Act
    const result = await findRelationTypeByName(client as never, "공급");

    // Assert
    expect(result).toEqual({ ok: false, message: "db error" });
  });
});

describe("insertRelationType (M5)", () => {
  it("생성 성공 시 {kind:'created', row}를 반환한다", async () => {
    // Arrange
    const row = { id: "rt-1", name: "라이선스", is_directed: true, is_active: true, created_at: "t", updated_at: "t" };
    const singleMock = vi.fn(async () => ({ data: row, error: null }));
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const client = { from: vi.fn(() => ({ insert: insertMock })) };

    // Act
    const result = await insertRelationType(client as never, { name: "라이선스", isDirected: true });

    // Assert
    expect(result).toEqual({ kind: "created", row });
    expect(insertMock).toHaveBeenCalledWith({ name: "라이선스", is_directed: true });
  });

  it("23505 유니크 위반 시 {kind:'duplicate'}를 반환한다(throw 없음, R-2 레이스 방어)", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate" } })) })),
        })),
      })),
    };

    // Act
    const result = await insertRelationType(client as never, { name: "공급", isDirected: true });

    // Assert
    expect(result).toEqual({ kind: "duplicate" });
  });

  it("기타 오류 시 {kind:'error'}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "42P01", message: "boom" } })) })),
        })),
      })),
    };

    // Act
    const result = await insertRelationType(client as never, { name: "공급", isDirected: true });

    // Assert
    expect(result).toEqual({ kind: "error", message: "boom" });
  });
});

describe("updateRelationType (M5)", () => {
  it("부분 patch(name만)로 UPDATE하고 {kind:'updated', row}를 반환한다", async () => {
    // Arrange
    const row = { id: "rt-1", name: "새이름", is_directed: true, is_active: true, created_at: "t", updated_at: "t2" };
    const maybeSingleMock = vi.fn(async () => ({ data: row, error: null }));
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ update: updateMock })) };

    // Act
    const result = await updateRelationType(client as never, "rt-1", { name: "새이름" });

    // Assert
    expect(result).toEqual({ kind: "updated", row });
    expect(updateMock).toHaveBeenCalledWith({ name: "새이름" });
    expect(eqMock).toHaveBeenCalledWith("id", "rt-1");
  });

  it("patch에 전달한 키만 UPDATE에 포함된다(isActive만)", async () => {
    // Arrange
    const row = { id: "rt-1", name: "공급", is_directed: true, is_active: false, created_at: "t", updated_at: "t2" };
    const updateMock = vi.fn(() => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })) })),
    }));
    const client = { from: vi.fn(() => ({ update: updateMock })) };

    // Act
    await updateRelationType(client as never, "rt-1", { is_active: false });

    // Assert
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
  });

  it("갱신 대상 0행이면 {kind:'not_found'}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
        })),
      })),
    };

    // Act
    const result = await updateRelationType(client as never, "rt-missing", { name: "새이름" });

    // Assert
    expect(result).toEqual({ kind: "not_found" });
  });

  it("23505 유니크 위반 시 {kind:'duplicate'}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: { code: "23505", message: "dup" } })) })),
          })),
        })),
      })),
    };

    // Act
    const result = await updateRelationType(client as never, "rt-1", { name: "중복" });

    // Assert
    expect(result).toEqual({ kind: "duplicate" });
  });

  it("기타 오류 시 {kind:'error'}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: { code: "500", message: "boom" } })) })),
          })),
        })),
      })),
    };

    // Act
    const result = await updateRelationType(client as never, "rt-1", { name: "x" });

    // Assert
    expect(result).toEqual({ kind: "error", message: "boom" });
  });
});

describe("BR-1 물리 삭제 금지 정적 검사", () => {
  it("repository 모듈이 delete 관련 export를 갖지 않는다", async () => {
    const repositoryModule = await import("./repository");
    const exportNames = Object.keys(repositoryModule);
    const hasDeleteExport = exportNames.some((name) => /delete/i.test(name));
    expect(hasDeleteExport).toBe(false);
  });
});
