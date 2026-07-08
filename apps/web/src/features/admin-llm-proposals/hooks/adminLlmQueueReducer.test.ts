import { describe, expect, it } from "vitest";
import {
  adminLlmQueueReducer,
  initialAdminLlmQueueState,
  type AdminLlmQueueState,
} from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";

describe("initialAdminLlmQueueState", () => {
  it("statusFilter='pending', page=1, 선택/다이얼로그 없음이 초기 상태다", () => {
    expect(initialAdminLlmQueueState).toEqual({
      statusFilter: "pending",
      page: 1,
      selectedProposalId: null,
      rejectTarget: null,
    });
  });
});

describe("FILTER_CHANGED", () => {
  it("필터 교체 + page 1 리셋 + 선택/다이얼로그 해제", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      statusFilter: "pending",
      page: 3,
      selectedProposalId: "p-1",
      rejectTarget: { proposalId: "p-1", reason: "사유" },
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "FILTER_CHANGED", filter: "approved" });

    // Assert
    expect(next).toEqual({
      statusFilter: "approved",
      page: 1,
      selectedProposalId: null,
      rejectTarget: null,
    });
  });

  it("동일 필터 재선택 시 동일 참조를 반환한다(불필요 렌더 방지)", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "FILTER_CHANGED", filter: "pending" });

    // Assert
    expect(next).toBe(state);
  });
});

describe("PAGE_CHANGED", () => {
  it("페이지 교체 + 선택 해제", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      ...initialAdminLlmQueueState,
      selectedProposalId: "p-1",
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PAGE_CHANGED", page: 2 });

    // Assert
    expect(next.page).toBe(2);
    expect(next.selectedProposalId).toBeNull();
  });

  it("page=0 등 비정상 값은 무시하고 동일 참조를 반환한다", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "PAGE_CHANGED", page: 0 });

    // Assert
    expect(next).toBe(state);
  });

  it("음수 페이지도 무시한다", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "PAGE_CHANGED", page: -1 });

    // Assert
    expect(next).toBe(state);
  });
});

describe("PROPOSAL_SELECTED", () => {
  it("선택을 설정한다", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_SELECTED", proposalId: "p-1" });

    // Assert
    expect(next.selectedProposalId).toBe("p-1");
  });

  it("동일 ID 재선택 시 동일 참조를 반환한다", () => {
    // Arrange
    const state: AdminLlmQueueState = { ...initialAdminLlmQueueState, selectedProposalId: "p-1" };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_SELECTED", proposalId: "p-1" });

    // Assert
    expect(next).toBe(state);
  });
});

describe("PANEL_CLOSED", () => {
  it("selectedProposalId를 null로 만든다", () => {
    // Arrange
    const state: AdminLlmQueueState = { ...initialAdminLlmQueueState, selectedProposalId: "p-1" };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PANEL_CLOSED" });

    // Assert
    expect(next.selectedProposalId).toBeNull();
  });
});

describe("REJECT_DIALOG_OPENED", () => {
  it("rejectTarget을 빈 사유로 설정한다", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "REJECT_DIALOG_OPENED", proposalId: "p-1" });

    // Assert
    expect(next.rejectTarget).toEqual({ proposalId: "p-1", reason: "" });
  });
});

describe("REJECT_REASON_CHANGED", () => {
  it("다이얼로그가 열린 상태에서 사유를 갱신한다", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      ...initialAdminLlmQueueState,
      rejectTarget: { proposalId: "p-1", reason: "" },
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "REJECT_REASON_CHANGED", reason: "사유 입력" });

    // Assert
    expect(next.rejectTarget).toEqual({ proposalId: "p-1", reason: "사유 입력" });
  });

  it("rejectTarget이 null이면 무시하고 동일 참조를 반환한다(지연 이벤트 방어)", () => {
    // Arrange
    const state = initialAdminLlmQueueState;

    // Act
    const next = adminLlmQueueReducer(state, { type: "REJECT_REASON_CHANGED", reason: "무시됨" });

    // Assert
    expect(next).toBe(state);
  });
});

describe("REJECT_DIALOG_CLOSED", () => {
  it("rejectTarget을 null로 만든다", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      ...initialAdminLlmQueueState,
      rejectTarget: { proposalId: "p-1", reason: "사유" },
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "REJECT_DIALOG_CLOSED" });

    // Assert
    expect(next.rejectTarget).toBeNull();
  });
});

describe("PROPOSAL_RESOLVED", () => {
  it("선택 중인 제안이면 선택을 해제한다", () => {
    // Arrange
    const state: AdminLlmQueueState = { ...initialAdminLlmQueueState, selectedProposalId: "p-1" };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_RESOLVED", proposalId: "p-1" });

    // Assert
    expect(next.selectedProposalId).toBeNull();
  });

  it("다이얼로그 대상 제안이면 다이얼로그를 해제한다", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      ...initialAdminLlmQueueState,
      rejectTarget: { proposalId: "p-1", reason: "사유" },
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_RESOLVED", proposalId: "p-1" });

    // Assert
    expect(next.rejectTarget).toBeNull();
  });

  it("선택+다이얼로그 모두 대상이면 둘 다 해제한다", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      ...initialAdminLlmQueueState,
      selectedProposalId: "p-1",
      rejectTarget: { proposalId: "p-1", reason: "사유" },
    };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_RESOLVED", proposalId: "p-1" });

    // Assert
    expect(next.selectedProposalId).toBeNull();
    expect(next.rejectTarget).toBeNull();
  });

  it("무관한 제안이면 동일 참조를 반환한다(상태 불변)", () => {
    // Arrange
    const state: AdminLlmQueueState = { ...initialAdminLlmQueueState, selectedProposalId: "p-1" };

    // Act
    const next = adminLlmQueueReducer(state, { type: "PROPOSAL_RESOLVED", proposalId: "p-2" });

    // Assert
    expect(next).toBe(state);
  });
});

describe("비변이(immutability) 확인", () => {
  it("모든 Action에서 입력 state 객체가 변이되지 않는다", () => {
    // Arrange
    const state: AdminLlmQueueState = {
      statusFilter: "pending",
      page: 2,
      selectedProposalId: "p-1",
      rejectTarget: { proposalId: "p-1", reason: "사유" },
    };
    const snapshot = structuredClone(state);

    // Act
    adminLlmQueueReducer(state, { type: "FILTER_CHANGED", filter: "approved" });
    adminLlmQueueReducer(state, { type: "PAGE_CHANGED", page: 5 });
    adminLlmQueueReducer(state, { type: "PROPOSAL_SELECTED", proposalId: "p-2" });
    adminLlmQueueReducer(state, { type: "PANEL_CLOSED" });
    adminLlmQueueReducer(state, { type: "REJECT_DIALOG_OPENED", proposalId: "p-3" });
    adminLlmQueueReducer(state, { type: "REJECT_REASON_CHANGED", reason: "변경" });
    adminLlmQueueReducer(state, { type: "REJECT_DIALOG_CLOSED" });
    adminLlmQueueReducer(state, { type: "PROPOSAL_RESOLVED", proposalId: "p-1" });

    // Assert
    expect(state).toEqual(snapshot);
  });
});
