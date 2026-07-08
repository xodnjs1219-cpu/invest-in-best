import { describe, expect, it, vi } from "vitest";
import {
  createValuechainsDeleteRepository,
  RepositoryError,
} from "@/features/valuechains/backend/repository";

/** 체인형 Supabase 쿼리 빌더를 모킹하는 헬퍼(기존 repository.test.ts와 동일 패턴). */
const createQueryBuilderMock = (result: { data: unknown; error: unknown }) => {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  builder.select = record("select");
  builder.eq = record("eq");
  builder.delete = record("delete");
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { builder, calls };
};

describe("createValuechainsDeleteRepository", () => {
  describe("findChainOwnershipById", () => {
    it("행 존재 시 {id, chain_type, owner_id}를 반환한다", async () => {
      const row = { id: "chain-1", chain_type: "user", owner_id: "owner-1" };
      const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      const result = await repo.findChainOwnershipById("chain-1");

      expect(client.from).toHaveBeenCalledWith("value_chains");
      expect(calls).toContainEqual({ method: "eq", args: ["id", "chain-1"] });
      expect(result).toEqual(row);
    });

    it("0행이면 null을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      const result = await repo.findChainOwnershipById("missing");

      expect(result).toBeNull();
    });

    it("Supabase 오류 시 RepositoryError를 throw한다(예외 아닌 정규화 형태 유지)", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: { message: "db down" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      await expect(repo.findChainOwnershipById("chain-1")).rejects.toThrow(RepositoryError);
    });
  });

  describe("deleteUserChainById", () => {
    it("id·chain_type=user·owner_id 3조건을 모두 적용해 삭제를 수행하고 성공을 반환한다", async () => {
      const calls: { method: string; args: unknown[] }[] = [];
      const builder: Record<string, unknown> = {};
      const record =
        (method: string) =>
        (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      builder.delete = record("delete");
      builder.eq = record("eq");
      builder.then = (resolve: (value: unknown) => void) => resolve({ error: null });

      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      const result = await repo.deleteUserChainById("chain-1", "owner-1");

      expect(client.from).toHaveBeenCalledWith("value_chains");
      expect(calls).toContainEqual({ method: "eq", args: ["id", "chain-1"] });
      expect(calls).toContainEqual({ method: "eq", args: ["chain_type", "user"] });
      expect(calls).toContainEqual({ method: "eq", args: ["owner_id", "owner-1"] });
      expect(result).toEqual({ ok: true });
    });

    it("영향 행 0건(동시 삭제 경합)도 성공으로 취급한다", async () => {
      const builder: Record<string, unknown> = {};
      builder.delete = () => builder;
      builder.eq = () => builder;
      builder.then = (resolve: (value: unknown) => void) => resolve({ error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      const result = await repo.deleteUserChainById("chain-1", "owner-1");

      expect(result).toEqual({ ok: true });
    });

    it("Supabase 오류 시 { ok: false, message }를 반환한다(예외 미발생)", async () => {
      const builder: Record<string, unknown> = {};
      builder.delete = () => builder;
      builder.eq = () => builder;
      builder.then = (resolve: (value: unknown) => void) => resolve({ error: { message: "db down" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsDeleteRepository(client as never);

      const result = await repo.deleteUserChainById("chain-1", "owner-1");

      expect(result).toEqual({ ok: false, message: "db down" });
    });
  });
});
