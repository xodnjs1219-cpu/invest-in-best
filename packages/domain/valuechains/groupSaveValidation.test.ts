import { describe, expect, it } from "vitest";
import { validateGroupsPayload, pruneEmptyGroups } from "./groupSaveValidation";

describe("validateGroupsPayload", () => {
  it("정상 페이로드(그룹 2, 노드가 각각 참조) → 위반 0건", () => {
    const violations = validateGroupsPayload({
      groups: [
        { clientGroupId: "g1", name: "소재" },
        { clientGroupId: "g2", name: "셀 제조" },
      ],
      nodes: [
        { clientNodeId: "n1", groupClientId: "g1" },
        { clientNodeId: "n2", groupClientId: "g2" },
      ],
    });
    expect(violations).toEqual([]);
  });

  it("이름 공백 그룹 → GROUP_NAME_REQUIRED + 해당 clientGroupId 포함", () => {
    const violations = validateGroupsPayload({
      groups: [{ clientGroupId: "g1", name: "   " }],
      nodes: [{ clientNodeId: "n1", groupClientId: "g1" }],
    });
    expect(violations).toEqual([
      { reason: "GROUP_NAME_REQUIRED", clientGroupIds: ["g1"], clientNodeIds: [] },
    ]);
  });

  it("clientGroupId 'g1' 2건 → GROUP_KEY_DUPLICATE + clientGroupIds에 중복 그룹 식별", () => {
    const violations = validateGroupsPayload({
      groups: [
        { clientGroupId: "g1", name: "소재" },
        { clientGroupId: "g1", name: "셀 제조" },
      ],
      nodes: [],
    });
    expect(violations).toEqual([
      { reason: "GROUP_KEY_DUPLICATE", clientGroupIds: ["g1"], clientNodeIds: [] },
    ]);
  });

  it("노드가 미존재 groupClientId: 'gx' 참조 → GROUP_REF_INVALID + 해당 clientNodeIds 포함", () => {
    const violations = validateGroupsPayload({
      groups: [{ clientGroupId: "g1", name: "소재" }],
      nodes: [{ clientNodeId: "n1", groupClientId: "gx" }],
    });
    expect(violations).toEqual([
      { reason: "GROUP_REF_INVALID", clientGroupIds: [], clientNodeIds: ["n1"] },
    ]);
  });

  it("groupClientId: null 노드만 존재 → 위반 0건", () => {
    const violations = validateGroupsPayload({
      groups: [{ clientGroupId: "g1", name: "소재" }],
      nodes: [{ clientNodeId: "n1", groupClientId: null }],
    });
    expect(violations).toEqual([]);
  });

  it("복수 위반 혼재(이름 공백 + 참조 위반) → 전부 수집(2건)", () => {
    const violations = validateGroupsPayload({
      groups: [{ clientGroupId: "g1", name: "" }],
      nodes: [{ clientNodeId: "n1", groupClientId: "gx" }],
    });
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.reason).sort()).toEqual(["GROUP_NAME_REQUIRED", "GROUP_REF_INVALID"]);
  });
});

describe("pruneEmptyGroups", () => {
  it("참조 노드 0개 그룹만 제거, 참조 그룹은 유지, prunedGroupIds 정확", () => {
    const result = pruneEmptyGroups(
      [
        { clientGroupId: "g1", name: "소재" },
        { clientGroupId: "g2", name: "빈 그룹" },
      ],
      [{ clientNodeId: "n1", groupClientId: "g1" }],
    );
    expect(result.groups).toEqual([{ clientGroupId: "g1", name: "소재" }]);
    expect(result.prunedGroupIds).toEqual(["g2"]);
  });

  it("빈 그룹 없음 → 원본과 동일 구성 반환", () => {
    const groups = [{ clientGroupId: "g1", name: "소재" }];
    const result = pruneEmptyGroups(groups, [{ clientNodeId: "n1", groupClientId: "g1" }]);
    expect(result.groups).toEqual(groups);
    expect(result.prunedGroupIds).toEqual([]);
  });

  it("전 그룹이 빈 그룹 → groups: []", () => {
    const result = pruneEmptyGroups(
      [
        { clientGroupId: "g1", name: "소재" },
        { clientGroupId: "g2", name: "셀 제조" },
      ],
      [],
    );
    expect(result.groups).toEqual([]);
    expect(result.prunedGroupIds).toEqual(["g1", "g2"]);
  });

  it("입력 배열 비변이(불변성)", () => {
    const groups = [
      { clientGroupId: "g1", name: "소재" },
      { clientGroupId: "g2", name: "빈 그룹" },
    ];
    const nodes = [{ clientNodeId: "n1", groupClientId: "g1" }];
    const groupsCopy = [...groups];
    const nodesCopy = [...nodes];
    pruneEmptyGroups(groups, nodes);
    expect(groups).toEqual(groupsCopy);
    expect(nodes).toEqual(nodesCopy);
  });
});
