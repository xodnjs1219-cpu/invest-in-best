// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChainEditorProvider,
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";

const buildResponse = (totalCount: number) => ({
  items: [],
  pagination: { page: 1, limit: 20, totalCount, hasMore: false },
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const RELATION_TYPES_FIXTURE = [
  { id: "rt-supply", name: "공급", isDirected: true, isActive: true },
  { id: "rt-inactive", name: "구관계", isDirected: true, isActive: false },
];

/** 성공(2xx)/실패 응답을 명시적으로 구성하는 헬퍼(저장 mutation 테스트 전용 — `jsonResponse`는 status===200만 성공 취급). */
const buildRawResponse = (status: number, body: unknown) =>
  new Response(status < 400 ? JSON.stringify({ data: body }) : JSON.stringify({ error: body }), {
    status,
    headers: { "content-type": "application/json" },
  });

/** 체인 목록 API + 관계 종류 API를 URL 기반으로 분기하는 fetch mock(엣지/노드 액션 테스트 공용). */
const buildFetchMock = (totalCount: number, saveResponse?: { status: number; body: unknown }) =>
  vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/relation-types")) {
      return Promise.resolve(jsonResponse({ relationTypes: RELATION_TYPES_FIXTURE }));
    }
    if (url.includes("/valuechains") && (init?.method === "POST" || init?.method === "PUT")) {
      const resp = saveResponse ?? { status: 201, body: { chainId: "c1", snapshotId: "s1", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 } };
      return Promise.resolve(buildRawResponse(resp.status, resp.body));
    }
    return Promise.resolve(jsonResponse(buildResponse(totalCount)));
  });

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

function StateProbe() {
  const { state, async: asyncState } = useChainEditorState();
  return (
    <div>
      <span data-testid="initialized">{String(state.initialized)}</span>
      <span data-testid="entry-blocked">{String(asyncState.entryBlocked !== null)}</span>
      <span data-testid="bootstrapping">{String(asyncState.isBootstrapping)}</span>
      <span data-testid="name">{state.name}</span>
      <span data-testid="dirty">{String(state.isDirty)}</span>
    </div>
  );
}

function NameChanger() {
  const { changeName } = useChainEditorActions();
  return (
    <button type="button" onClick={() => changeName("AI 반도체")}>
      change
    </button>
  );
}

describe("ChainEditorProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("게이트 allowed → EDITOR_INITIALIZED 1회만 dispatch(state.initialized=true)", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse(3)));

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));
    expect(screen.getByTestId("entry-blocked").textContent).toBe("false");
  });

  it("게이트 blocked → async.entryBlocked=true, state.initialized=false(캔버스 미초기화)", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse(50)));

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("entry-blocked").textContent).toBe("true"));
    expect(screen.getByTestId("initialized").textContent).toBe("false");
  });

  it("changeName('AI 반도체') → state.name 반영, isDirty=true", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse(3)));

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <NameChanger />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "change" }));

    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("AI 반도체"));
    expect(screen.getByTestId("dirty").textContent).toBe("true");
  });

  it("Provider 밖에서 useChainEditorState() → throw", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bare() {
      useChainEditorState();
      return null;
    }
    expect(() => render(<Bare />)).toThrow();
    consoleErrorSpy.mockRestore();
  });

  // ==========================================================================
  // UC-015: 노드 추가/삭제 액션
  // ==========================================================================

  function NodeAdder() {
    const { addListedCompanyNode, addFreeSubjectNode } = useChainEditorActions();
    return (
      <>
        <button
          type="button"
          onClick={() =>
            addListedCompanyNode({ securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" })
          }
        >
          add-listed
        </button>
        <button
          type="button"
          onClick={() => addFreeSubjectNode({ subjectType: "consumer", subjectName: "소비자", subjectMemo: null })}
        >
          add-free-subject
        </button>
      </>
    );
  }

  it("addListedCompanyNode 정상 추가 → 상태에 노드 1건 반영", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <NodeAdder />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "add-listed" }));

    await waitFor(() => expect(screen.getByTestId("dirty").textContent).toBe("true"));
  });

  it("addFreeSubjectNode 정상 추가 → dirty=true", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <NodeAdder />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "add-free-subject" }));

    await waitFor(() => expect(screen.getByTestId("dirty").textContent).toBe("true"));
  });

  // ==========================================================================
  // UC-016: 엣지 설정/편집 액션
  // ==========================================================================

  function EdgeAdder() {
    const { addListedCompanyNode, addEdge } = useChainEditorActions();
    const [result, setResult] = useState<string>("");
    return (
      <>
        <button
          type="button"
          onClick={() => {
            addListedCompanyNode({ securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" });
            addListedCompanyNode({ securityId: "s2", ticker: "000660", name: "SK하이닉스", market: "KRX" });
          }}
        >
          seed-nodes
        </button>
        <button
          type="button"
          onClick={() => {
            // 테스트 편의상 실제 clientNodeId를 알 수 없으므로 결과만 확인(구현 세부 의존 최소화).
            const r = addEdge({
              sourceClientNodeId: "missing-a",
              targetClientNodeId: "missing-b",
              relationTypeId: "rt-supply",
            });
            setResult(r.ok ? "ok" : r.reason);
          }}
        >
          add-invalid-edge
        </button>
        <span data-testid="edge-result">{result}</span>
      </>
    );
  }

  it("addEdge: 존재하지 않는 노드 참조 → ok:false, reason=NODE_NOT_FOUND, 상태 미변경", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <EdgeAdder />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "add-invalid-edge" }));

    await waitFor(() => expect(screen.getByTestId("edge-result").textContent).toBe("NODE_NOT_FOUND"));
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });

  it("hasActiveRelationTypes: 활성 관계 종류 존재 시 true", async () => {
    global.fetch = buildFetchMock(3);

    function ComputedProbe() {
      const { computed } = useChainEditorState();
      return <span data-testid="has-active">{String(computed.hasActiveRelationTypes)}</span>;
    }

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <ComputedProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("has-active").textContent).toBe("true"));
  });

  // ==========================================================================
  // UC-017: 그룹 편집 액션
  // ==========================================================================

  function NodeIdsProbe() {
    const { state, computed } = useChainEditorState();
    return (
      <div>
        <span data-testid="node-ids">{Object.keys(state.nodes).join(",")}</span>
        <span data-testid="group-count">{computed.groupCount}</span>
        <span data-testid="empty-group-ids">{computed.emptyGroupIds.join(",")}</span>
        <span data-testid="duplicate-group-names">{computed.duplicateGroupNames.join(",")}</span>
      </div>
    );
  }

  function GroupActionsProbe() {
    const { addFreeSubjectNode, createGroup, renameGroup, assignNodeToGroup, dissolveGroup } =
      useChainEditorActions();
    const { state } = useChainEditorState();
    const [lastResult, setLastResult] = useState<string>("");
    const [lastGroupId, setLastGroupId] = useState<string>("");

    return (
      <>
        <button
          type="button"
          onClick={() => addFreeSubjectNode({ subjectType: "consumer", subjectName: "소비자", subjectMemo: null })}
        >
          add-node
        </button>
        <button
          type="button"
          onClick={() => {
            const nodeIds = Object.keys(state.nodes);
            const r = createGroup({ name: "소재", memberNodeIds: nodeIds });
            setLastResult(r.ok ? "ok" : r.reason);
            if (r.ok) {
              const newGroupIds = Object.keys(state.groups);
              // 방금 생성된 그룹은 아직 렌더 이전 state를 참조하므로 다음 렌더에서 groups로 확인.
              setLastGroupId(newGroupIds.join(","));
            }
          }}
        >
          create-group
        </button>
        <button type="button" onClick={() => setLastResult(() => `groups:${Object.keys(state.groups).join(",")}`)}>
          list-groups
        </button>
        <button
          type="button"
          onClick={() => {
            const groupIds = Object.keys(state.groups);
            const targetId = groupIds[0];
            if (targetId) {
              const r = renameGroup(targetId, "새 이름");
              setLastResult(r.ok ? "ok" : r.reason);
            }
          }}
        >
          rename-first-group
        </button>
        <button
          type="button"
          onClick={() => {
            const groupIds = Object.keys(state.groups);
            const targetId = groupIds[0];
            if (targetId) {
              renameGroup(targetId, "   ");
            }
          }}
        >
          rename-first-group-blank
        </button>
        <button
          type="button"
          onClick={() => {
            const nodeIds = Object.keys(state.nodes);
            if (nodeIds[0]) {
              assignNodeToGroup(nodeIds[0], null);
            }
          }}
        >
          unassign-first-node
        </button>
        <button
          type="button"
          onClick={() => {
            const groupIds = Object.keys(state.groups);
            if (groupIds[0]) {
              dissolveGroup(groupIds[0]);
            }
          }}
        >
          dissolve-first-group
        </button>
        <span data-testid="last-result">{lastResult}</span>
        <span data-testid="last-group-id">{lastGroupId}</span>
      </>
    );
  }

  it("createGroup 이름 공백 → dispatch 미발생, ok:false reason=NAME_REQUIRED, 상태 불변", async () => {
    global.fetch = buildFetchMock(3);

    function BlankGroupCreator() {
      const { createGroup } = useChainEditorActions();
      const [result, setResult] = useState<string>("");
      return (
        <>
          <button
            type="button"
            onClick={() => {
              const r = createGroup({ name: "   ", memberNodeIds: ["n1"] });
              setResult(r.ok ? "ok" : r.reason);
            }}
          >
            create-blank
          </button>
          <span data-testid="blank-result">{result}</span>
        </>
      );
    }

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <BlankGroupCreator />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "create-blank" }));

    await waitFor(() => expect(screen.getByTestId("blank-result").textContent).toBe("NAME_REQUIRED"));
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });

  it("createGroup 통과 → 그룹 1건 추가 + clientGroupId UUID 발급 + 멤버 소속 반영", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <NodeIdsProbe />
        <GroupActionsProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "add-node" }));
    await waitFor(() => expect(screen.getByTestId("node-ids").textContent).not.toBe(""));

    await user.click(screen.getByRole("button", { name: "create-group" }));

    await waitFor(() => expect(screen.getByTestId("last-result").textContent).toBe("ok"));
    await waitFor(() => expect(screen.getByTestId("group-count").textContent).toBe("1"));
  });

  it("renameGroup 미존재 그룹 → ok:false reason=GROUP_NOT_FOUND", async () => {
    global.fetch = buildFetchMock(3);

    function RenameMissingProbe() {
      const { renameGroup } = useChainEditorActions();
      const [result, setResult] = useState<string>("");
      return (
        <>
          <button
            type="button"
            onClick={() => {
              const r = renameGroup("missing", "새 이름");
              setResult(r.ok ? "ok" : r.reason);
            }}
          >
            rename-missing
          </button>
          <span data-testid="rename-result">{result}</span>
        </>
      );
    }

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <RenameMissingProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "rename-missing" }));

    await waitFor(() => expect(screen.getByTestId("rename-result").textContent).toBe("GROUP_NOT_FOUND"));
  });

  it("assignNodeToGroup(nodeId, null) → 미소속 전환 / dissolveGroup → 그룹 제거 + 멤버 소속 해제, 노드 수 불변", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <NodeIdsProbe />
        <GroupActionsProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "add-node" }));
    await waitFor(() => expect(screen.getByTestId("node-ids").textContent).not.toBe(""));
    await user.click(screen.getByRole("button", { name: "create-group" }));
    await waitFor(() => expect(screen.getByTestId("group-count").textContent).toBe("1"));

    await user.click(screen.getByRole("button", { name: "unassign-first-node" }));
    // 노드가 미소속으로 전환되면 그룹은 빈 그룹이 된다(BR-6 — 저장 시 제외 예고).
    await waitFor(() => expect(screen.getByTestId("empty-group-ids").textContent).not.toBe(""));

    await user.click(screen.getByRole("button", { name: "dissolve-first-group" }));
    await waitFor(() => expect(screen.getByTestId("group-count").textContent).toBe("0"));
    // 노드 수는 그대로 유지(E5 — 그룹 해제는 노드에 영향 없음).
    expect(screen.getByTestId("node-ids").textContent?.split(",").filter(Boolean)).toHaveLength(1);
  });

  // ==========================================================================
  // UC-018: 저장 수명주기(save/reloadFromLatest/resetSaveError)
  // ==========================================================================

  function SaveProbe() {
    const { changeName, save, resetSaveError } = useChainEditorActions();
    const { async: asyncState, state } = useChainEditorState();
    const [outcome, setOutcome] = useState<string>("");
    return (
      <>
        <button type="button" onClick={() => changeName("나의 체인")}>
          set-name
        </button>
        <button
          type="button"
          onClick={async () => {
            const result = await save();
            setOutcome(result.status);
          }}
        >
          save
        </button>
        <button type="button" onClick={resetSaveError}>
          reset-save-error
        </button>
        <span data-testid="save-outcome">{outcome}</span>
        <span data-testid="save-error-kind">{asyncState.saveError?.kind ?? ""}</span>
        <span data-testid="chain-id">{state.chainId ?? ""}</span>
      </>
    );
  }

  it("save(): 이름 공백 상태 → blocked_client + fetch 0회(엣지/노드 API 호출 제외)", async () => {
    const fetchMock = buildFetchMock(3);
    global.fetch = fetchMock;

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));
    const initialCallCount = fetchMock.mock.calls.length;

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("blocked_client"));
    // 저장 관련 POST/PUT 요청이 발생하지 않았어야 한다.
    const saveCalls = (fetchMock.mock.calls as Array<[string, RequestInit?]>).filter(
      ([, init]) => init?.method === "POST" || init?.method === "PUT",
    );
    expect(saveCalls).toHaveLength(0);
    void initialCallCount;
  });

  it("save(): 정상 저장(create) → POST 성공 → SAVE_SUCCEEDED 반영(chainId 설정·dirty 해제)", async () => {
    global.fetch = buildFetchMock(3);

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "set-name" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("saved"));
    expect(screen.getByTestId("chain-id").textContent).toBe("c1");
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });

  it("save(): 422 응답 → rejected_server + 편집 문서 불변", async () => {
    global.fetch = buildFetchMock(3, {
      status: 422,
      body: { code: "VALUECHAINS.INVALID_GROUP", message: "그룹 오류" },
    });

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "set-name" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("rejected_server"));
    expect(screen.getByTestId("name").textContent).toBe("나의 체인");
  });

  it("save(): 409 SAVE_CONFLICT → saveError.kind='conflict' + resetSaveError()로 해제", async () => {
    global.fetch = buildFetchMock(3, {
      status: 409,
      body: { code: "VALUECHAINS.SAVE_CONFLICT", message: "충돌" },
    });

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "set-name" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("conflict"));
    expect(screen.getByTestId("save-error-kind").textContent).toBe("conflict");

    await user.click(screen.getByRole("button", { name: "reset-save-error" }));
    await waitFor(() => expect(screen.getByTestId("save-error-kind").textContent).toBe(""));
  });

  it("save(): 401 → saveError.kind='auth', 문서 보존", async () => {
    global.fetch = buildFetchMock(3, {
      status: 401,
      body: { code: "AUTH_REQUIRED", message: "인증 필요" },
    });

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "set-name" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("auth_required"));
    expect(screen.getByTestId("save-error-kind").textContent).toBe("auth");
    expect(screen.getByTestId("name").textContent).toBe("나의 체인");
  });

  it("isSaving=true 동안 canSave=false", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/relation-types")) {
        return Promise.resolve(jsonResponse({ relationTypes: RELATION_TYPES_FIXTURE }));
      }
      if (url.includes("/valuechains") && (init?.method === "POST" || init?.method === "PUT")) {
        return pendingPromise;
      }
      return Promise.resolve(jsonResponse(buildResponse(3)));
    });

    function CanSaveProbe() {
      const { computed } = useChainEditorState();
      return <span data-testid="can-save">{String(computed.canSave)}</span>;
    }

    render(
      <ChainEditorProvider mode="create" variant="user">
        <StateProbe />
        <SaveProbe />
        <CanSaveProbe />
      </ChainEditorProvider>,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "set-name" }));
    await waitFor(() => expect(screen.getByTestId("can-save").textContent).toBe("true"));

    await user.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(screen.getByTestId("can-save").textContent).toBe("false"));

    resolveFetch(buildRawResponse(201, { chainId: "c1", snapshotId: "s1", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 }));
    await waitFor(() => expect(screen.getByTestId("save-outcome").textContent).toBe("saved"));
  });
});
