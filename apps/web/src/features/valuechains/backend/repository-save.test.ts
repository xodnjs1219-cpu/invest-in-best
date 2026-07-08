import { describe, expect, it, vi } from "vitest";
import { createValuechainsSaveRepository, SaveRpcError } from "@/features/valuechains/backend/repository";

const createQueryBuilderMock = (result: { data: unknown; error: unknown; count?: number }) => {
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
  builder.neq = record("neq");
  builder.in = record("in");
  builder.order = record("order");
  builder.limit = record("limit");
  builder.maybeSingle = vi.fn(async () => ({ data: result.data, error: result.error }));
  builder.then = (resolve: (value: unknown) => void) =>
    resolve({ data: result.data, error: result.error, count: result.count });
  return { builder, calls };
};

describe("createValuechainsSaveRepository", () => {
  it("existsChainNameForOwner: excludeChainId 전달 시 neq('id', ...) 조건 포함", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: null, error: null, count: 0 });
    const client = { from: vi.fn(() => builder) } as unknown as Parameters<typeof createValuechainsSaveRepository>[0];
    const repo = createValuechainsSaveRepository(client);

    await repo.existsChainNameForOwner("owner-1", "이름", "chain-1");

    expect(calls.some((c) => c.method === "neq" && c.args[0] === "id" && c.args[1] === "chain-1")).toBe(true);
  });

  it("existsChainNameForOwner: excludeChainId null이면 neq 미포함", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: null, error: null, count: 0 });
    const client = { from: vi.fn(() => builder) } as unknown as Parameters<typeof createValuechainsSaveRepository>[0];
    const repo = createValuechainsSaveRepository(client);

    await repo.existsChainNameForOwner("owner-1", "이름", null);

    expect(calls.some((c) => c.method === "neq")).toBe(false);
  });

  it("existsChainNameForOwner: count > 0이면 true 반환", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: null, count: 3 });
    const client = { from: vi.fn(() => builder) } as unknown as Parameters<typeof createValuechainsSaveRepository>[0];
    const repo = createValuechainsSaveRepository(client);

    const exists = await repo.existsChainNameForOwner("owner-1", "이름", null);
    expect(exists).toBe(true);
  });

  it("saveUserChainViaRpc: camelCase 입력이 RPC 파라미터(snake_case p_* 포함)로 정확 매핑", async () => {
    const singleMock = vi.fn(async () => ({ data: { outcome: "saved" }, error: null }));
    const rpcMock = vi.fn(() => ({ single: singleMock }));
    const client = { rpc: rpcMock } as unknown as Parameters<typeof createValuechainsSaveRepository>[0];
    const repo = createValuechainsSaveRepository(client);

    await repo.saveUserChainViaRpc({
      userId: "user-1",
      chainId: null,
      baseSnapshotId: null,
      name: "체인",
      focusType: "industry",
      focusSecurityId: null,
      groups: [{ clientGroupId: "g1", name: "소재" }],
      nodes: [],
      edges: [],
      maxChainsPerUser: 50,
      maxNodesPerChain: 100,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "save_user_chain",
      expect.objectContaining({
        p_user_id: "user-1",
        p_chain_id: null,
        p_max_chains_per_user: 50,
        p_max_nodes_per_chain: 100,
      }),
    );
  });

  it("saveUserChainViaRpc: rpc error 응답 → SaveRpcError로 정규화(throw)", async () => {
    const singleMock = vi.fn(async () => ({ data: null, error: { message: "db error", code: "23505" } }));
    const rpcMock = vi.fn(() => ({ single: singleMock }));
    const client = { rpc: rpcMock } as unknown as Parameters<typeof createValuechainsSaveRepository>[0];
    const repo = createValuechainsSaveRepository(client);

    await expect(
      repo.saveUserChainViaRpc({
        userId: "user-1",
        chainId: null,
        baseSnapshotId: null,
        name: "체인",
        focusType: "industry",
        focusSecurityId: null,
        groups: [],
        nodes: [],
        edges: [],
        maxChainsPerUser: 50,
        maxNodesPerChain: 100,
      }),
    ).rejects.toThrow(SaveRpcError);
  });
});
