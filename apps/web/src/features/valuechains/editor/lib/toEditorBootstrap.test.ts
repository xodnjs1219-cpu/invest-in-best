import { describe, expect, it } from "vitest";
import type { LatestSnapshotResponse } from "@/features/valuechains/lib/dto";
import { toEditorBootstrap } from "./toEditorBootstrap";

const buildDto = (overrides: Partial<LatestSnapshotResponse> = {}): LatestSnapshotResponse => ({
  chainId: "chain-1",
  chainType: "user",
  name: "나의 체인",
  focusType: "industry",
  focusSecurity: null,
  snapshotId: "snap-1",
  effectiveAt: "2026-07-05T09:00:00+09:00",
  groups: [{ id: "g1", name: "소재" }],
  nodes: [
    {
      id: "n1",
      nodeKind: "listed_company",
      groupId: "g1",
      security: { id: "s1", ticker: "005930", name: "삼성전자", market: "KRX", listingStatus: "listed" },
      subjectName: null,
      subjectType: null,
      subjectMemo: null,
      positionX: 120,
      positionY: 80,
    },
    {
      id: "n2",
      nodeKind: "free_subject",
      groupId: null,
      security: null,
      subjectName: "소비자",
      subjectType: "consumer",
      subjectMemo: null,
      positionX: null,
      positionY: null,
    },
  ],
  edges: [{ id: "e1", sourceNodeId: "n1", targetNodeId: "n2", relationTypeId: "rt1" }],
  ...overrides,
});

describe("toEditorBootstrap", () => {
  it("DTO(그룹 1·listed 1·free 1·엣지 1) → EditorBootstrap: ID 승계·baseSnapshotId=snapshotId·그룹 소속·좌표 보존", () => {
    const dto = buildDto();
    const bootstrap = toEditorBootstrap(dto);

    expect(bootstrap.chainId).toBe("chain-1");
    expect(bootstrap.baseSnapshotId).toBe("snap-1");
    expect(bootstrap.name).toBe("나의 체인");
    expect(bootstrap.groups.g1).toEqual({ clientGroupId: "g1", name: "소재" });
    expect(bootstrap.nodes.n1).toMatchObject({
      clientNodeId: "n1",
      nodeKind: "listed_company",
      groupClientId: "g1",
      position: { x: 120, y: 80 },
    });
    expect(bootstrap.nodes.n2).toMatchObject({
      clientNodeId: "n2",
      nodeKind: "free_subject",
      groupClientId: null,
    });
    expect(bootstrap.edges.e1).toEqual({
      clientEdgeId: "e1",
      sourceClientNodeId: "n1",
      targetClientNodeId: "n2",
      relationTypeId: "rt1",
    });
  });

  it("좌표 null 노드 → 기본 좌표 보정(유한값)", () => {
    const dto = buildDto();
    const bootstrap = toEditorBootstrap(dto);
    const n2Position = bootstrap.nodes.n2?.position;
    expect(n2Position).toBeDefined();
    expect(Number.isFinite(n2Position?.x)).toBe(true);
    expect(Number.isFinite(n2Position?.y)).toBe(true);
  });

  it("focusSecurity 존재 시 그대로 승계", () => {
    const dto = buildDto({
      focusType: "company",
      focusSecurity: { id: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
    });
    const bootstrap = toEditorBootstrap(dto);
    expect(bootstrap.focusSecurity).toEqual({
      securityId: "s1",
      ticker: "005930",
      name: "삼성전자",
      market: "KRX",
    });
  });
});
