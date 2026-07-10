import { describe, expect, it } from "vitest";
import type { IsoDate } from "@iib/domain";
import {
  buildRenderGraph,
  selectIsTimeTraveling,
} from "@/features/valuechains/state/chain-view.selectors";
import type { ChainViewResponse } from "@/features/valuechains/lib/dto";

describe("selectIsTimeTraveling", () => {
  it("selectedDate가 null이면 false", () => {
    expect(selectIsTimeTraveling({ timeline: { selectedDate: null, lastAppliedDate: null } } as never)).toBe(
      false,
    );
  });

  it("selectedDate가 있으면 true", () => {
    expect(
      selectIsTimeTraveling({
        timeline: { selectedDate: "2026-05-02" as IsoDate, lastAppliedDate: null },
      } as never),
    ).toBe(true);
  });
});

const buildStructure = (
  overrides: Partial<ChainViewResponse> = {},
): ChainViewResponse =>
  ({
    chain: {
      id: "chain-1",
      name: "체인",
      chainType: "official",
      focusType: "industry",
      focusSecurity: null,
      isOwner: false,
    },
    snapshot: { id: "snap-1", effectiveAt: "2026-07-01T00:00:00Z", changeSource: "admin_edit" },
    groups: [{ id: "g1", name: "그룹1" }],
    nodes: [
      {
        id: "n1",
        groupId: "g1",
        nodeKind: "listed_company",
        security: { id: "s1", ticker: "005930", name: "삼성전자", market: "KRX", listingStatus: "listed" },
        subjectName: null,
        subjectType: null,
        subjectMemo: null,
        position: { x: 10, y: 20 },
      },
      {
        id: "n2",
        groupId: "g1",
        nodeKind: "free_subject",
        security: null,
        subjectName: "소비자",
        subjectType: "consumer",
        subjectMemo: null,
        position: null,
      },
      {
        id: "n3",
        groupId: null,
        nodeKind: "free_subject",
        security: null,
        subjectName: "고립 노드",
        subjectType: "other",
        subjectMemo: null,
        position: { x: 500, y: 500 },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
        relationType: { id: "r1", name: "공급", isDirected: true, isActive: true },
      },
    ],
    dataFreshness: {
      sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
      lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
    },
    ...overrides,
  }) as ChainViewResponse;

describe("buildRenderGraph", () => {
  it("서버 position이 있는 노드는 그 좌표를 사용한다", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({ structure, localPositions: {} });

    const n1 = graph.nodes.find((n) => n.id === "n1");
    expect(n1?.position).toEqual({ x: 10, y: 20 });
  });

  it("position이 null인 노드는 auto-layout 좌표로 폴백한다(E11)", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({ structure, localPositions: {} });

    const n2 = graph.nodes.find((n) => n.id === "n2");
    expect(n2?.position).toBeDefined();
    expect(typeof n2?.position.x).toBe("number");
  });

  it("S5(localPositions) 오버라이드가 서버 좌표보다 우선한다", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({
      structure,
      localPositions: { n1: { x: 999, y: 888 } }
    });

    const n1 = graph.nodes.find((n) => n.id === "n1");
    expect(n1?.position).toEqual({ x: 999, y: 888 });
  });


  it("빈 그룹은 라벨만 있는 빈 클러스터로 유지된다(C-1)", () => {
    const structure = buildStructure({
      groups: [{ id: "g-empty", name: "빈 그룹" }],
      nodes: [],
      edges: [],
    });
    const graph = buildRenderGraph({ structure, localPositions: {} });

    expect(graph.groups).toEqual([{ id: "g-empty", label: "빈 그룹" }]);
  });

  it("고립 노드·그룹 미소속 노드는 정상 통과한다(E6)", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({ structure, localPositions: {} });

    const n3 = graph.nodes.find((n) => n.id === "n3");
    expect(n3).toBeDefined();
    expect(n3?.groupId).toBeNull();
  });

  it("상장기업 노드는 티커·시장·상장상태를 RenderNode로 매핑한다", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({ structure, localPositions: {} });

    const n1 = graph.nodes.find((n) => n.id === "n1");
    expect(n1?.kind).toBe("listed_company");
    expect(n1?.label).toBe("삼성전자");
    expect(n1?.sublabel).toBe("005930");
    expect(n1?.market).toBe("KRX");
    expect(n1?.listingStatus).toBe("listed");
  });

  it("자유 주체 노드는 subjectName·subjectType을 RenderNode로 매핑한다", () => {
    const structure = buildStructure();
    const graph = buildRenderGraph({ structure, localPositions: {} });

    const n2 = graph.nodes.find((n) => n.id === "n2");
    expect(n2?.kind).toBe("free_subject");
    expect(n2?.label).toBe("소비자");
    expect(n2?.subjectType).toBe("consumer");
  });
});
