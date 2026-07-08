import { describe, expect, it, vi } from "vitest";
import { createOfficialSaveRepository, SaveRpcError } from "@/features/valuechains/backend/repository";

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
  builder.then = (resolve: (value: unknown) => void) =>
    resolve({ data: result.data, error: result.error, count: result.count });
  return { builder, calls };
};

describe("createOfficialSaveRepository", () => {
  it("existsOfficialChainName: chain_type='official' 필터를 반드시 포함", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: null, error: null, count: 0 });
    const client = { from: vi.fn(() => builder) } as unknown as Parameters<typeof createOfficialSaveRepository>[0];
    const repo = createOfficialSaveRepository(client);

    await repo.existsOfficialChainName("이름", null);

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "chain_type" && c.args[1] === "official")).toBe(true);
  });

  it("existsOfficialChainName: excludeChainId 전달 시 neq 조건 포함", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: null, error: null, count: 0 });
    const client = { from: vi.fn(() => builder) } as unknown as Parameters<typeof createOfficialSaveRepository>[0];
    const repo = createOfficialSaveRepository(client);

    await repo.existsOfficialChainName("이름", "chain-1");

    expect(calls.some((c) => c.method === "neq" && c.args[0] === "id" && c.args[1] === "chain-1")).toBe(true);
  });

  it("saveOfficialChainRpc: 파라미터가 정확한 이름(p_chain_type/p_owner_id/p_change_source 없음)으로 전달", async () => {
    const singleMock = vi.fn(async () => ({ data: { outcome: "saved" }, error: null }));
    const rpcMock = vi.fn((_fn: string, _params: Record<string, unknown>) => ({ single: singleMock }));
    const client = { rpc: rpcMock } as unknown as Parameters<typeof createOfficialSaveRepository>[0];
    const repo = createOfficialSaveRepository(client);

    await repo.saveOfficialChainRpc({
      chainId: null,
      name: "체인",
      focusType: "industry",
      focusSecurityId: null,
      disclosureDate: null,
      baseSnapshotId: null,
      createdBy: "admin-1",
      groups: [],
      nodes: [],
      edges: [],
      maxNodesPerChain: 100,
    });

    const callArgs = rpcMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(rpcMock).toHaveBeenCalledWith("save_official_chain", expect.objectContaining({
      p_chain_id: null,
      p_name: "체인",
      p_created_by: "admin-1",
      p_max_nodes_per_chain: 100,
    }));
    expect(callArgs.p_chain_type).toBeUndefined();
    expect(callArgs.p_owner_id).toBeUndefined();
    expect(callArgs.p_change_source).toBeUndefined();
  });

  it("saveOfficialChainRpc: rpc error → SaveRpcError로 정규화(throw)", async () => {
    const singleMock = vi.fn(async () => ({ data: null, error: { message: "db error", code: "23505" } }));
    const rpcMock = vi.fn(() => ({ single: singleMock }));
    const client = { rpc: rpcMock } as unknown as Parameters<typeof createOfficialSaveRepository>[0];
    const repo = createOfficialSaveRepository(client);

    await expect(
      repo.saveOfficialChainRpc({
        chainId: null,
        name: "체인",
        focusType: "industry",
        focusSecurityId: null,
        disclosureDate: null,
        baseSnapshotId: null,
        createdBy: "admin-1",
        groups: [],
        nodes: [],
        edges: [],
        maxNodesPerChain: 100,
      }),
    ).rejects.toThrow(SaveRpcError);
  });
});
