import { describe, expect, it, vi } from "vitest";
import {
  createValuechainsCloneRepository,
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
  builder.order = record("order");
  builder.limit = record("limit");
  builder.head = record("head");
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { builder, calls };
};

describe("createValuechainsCloneRepository", () => {
  describe("findChainHeaderById", () => {
    it("행 존재 시 반환한다", async () => {
      const row = { id: "chain-1", chain_type: "official" };
      const { builder } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.findChainHeaderById("chain-1");

      expect(client.from).toHaveBeenCalledWith("value_chains");
      expect(result).toEqual(row);
    });

    it("행이 없으면 null을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.findChainHeaderById("missing");

      expect(result).toBeNull();
    });

    it("Supabase 오류 시 RepositoryError를 throw한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: { message: "db down" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      await expect(repo.findChainHeaderById("chain-1")).rejects.toThrow(RepositoryError);
    });
  });

  describe("countChainsByOwner", () => {
    it("count 응답을 number로 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      (builder as Record<string, unknown>).then = (resolve: (value: unknown) => void) =>
        resolve({ data: null, error: null, count: 12 });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.countChainsByOwner("owner-1");

      expect(result).toBe(12);
    });

    it("count가 null이면 0을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      (builder as Record<string, unknown>).then = (resolve: (value: unknown) => void) =>
        resolve({ data: null, error: null, count: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.countChainsByOwner("owner-1");

      expect(result).toBe(0);
    });
  });

  describe("listChainNamesByOwner", () => {
    it("이름 목록을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({
        data: [{ name: "반도체" }, { name: "2차전지" }],
        error: null,
      });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.listChainNamesByOwner("owner-1");

      expect(result).toEqual(["반도체", "2차전지"]);
    });
  });

  describe("findLatestSnapshot", () => {
    it("최신 스냅샷 1건을 반환한다", async () => {
      const row = { id: "snap-1", effective_at: "2026-07-01T00:00:00Z" };
      const { builder } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.findLatestSnapshot("chain-1");

      expect(result).toEqual(row);
    });

    it("스냅샷이 없으면 null을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.findLatestSnapshot("chain-1");

      expect(result).toBeNull();
    });
  });

  describe("countSnapshotComposition", () => {
    it("그룹/노드/엣지 카운트를 병렬 조회해 조합한다", async () => {
      const groupsBuilder = createQueryBuilderMock({ data: null, error: null });
      (groupsBuilder.builder as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null, count: 2 });
      const nodesBuilder = createQueryBuilderMock({ data: null, error: null });
      (nodesBuilder.builder as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null, count: 5 });
      const edgesBuilder = createQueryBuilderMock({ data: null, error: null });
      (edgesBuilder.builder as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null, count: 4 });

      const client = {
        from: vi.fn((table: string) => {
          if (table === "snapshot_groups") return groupsBuilder.builder;
          if (table === "snapshot_nodes") return nodesBuilder.builder;
          if (table === "snapshot_edges") return edgesBuilder.builder;
          throw new Error(`unexpected table ${table}`);
        }),
      };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.countSnapshotComposition("snap-1");

      expect(result).toEqual({ groupCount: 2, nodeCount: 5, edgeCount: 4 });
    });
  });

  describe("executeCloneChainRpc", () => {
    it("성공 시 RPC 결과 행을 반환한다", async () => {
      const row = {
        chain_id: "new-chain",
        snapshot_id: "new-snap",
        cloned_at: "2026-07-08T00:00:00Z",
        group_count: 1,
        node_count: 2,
        edge_count: 3,
      };
      const rpcBuilder = { single: vi.fn(async () => ({ data: row, error: null })) };
      const client = { rpc: vi.fn(() => rpcBuilder) };
      const repo = createValuechainsCloneRepository(client as never);

      const result = await repo.executeCloneChainRpc({
        sourceChainId: "chain-1",
        sourceSnapshotId: "snap-1",
        ownerId: "owner-1",
        name: "반도체",
      });

      expect(client.rpc).toHaveBeenCalledWith("clone_value_chain", {
        p_source_chain_id: "chain-1",
        p_source_snapshot_id: "snap-1",
        p_owner_id: "owner-1",
        p_name: "반도체",
      });
      expect(result).toEqual(row);
    });

    it("Supabase 오류(23505 포함) 시 code를 포함한 RepositoryError를 throw한다", async () => {
      const rpcBuilder = {
        single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate" } })),
      };
      const client = { rpc: vi.fn(() => rpcBuilder) };
      const repo = createValuechainsCloneRepository(client as never);

      await expect(
        repo.executeCloneChainRpc({
          sourceChainId: "chain-1",
          sourceSnapshotId: "snap-1",
          ownerId: "owner-1",
          name: "반도체",
        }),
      ).rejects.toMatchObject({ code: "23505" });
    });
  });
});
