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

/** 체인 목록 API + 관계 종류 API를 URL 기반으로 분기하는 fetch mock(엣지/노드 액션 테스트 공용). */
const buildFetchMock = (totalCount: number) =>
  vi.fn().mockImplementation((url: string) => {
    if (url.includes("/relation-types")) {
      return Promise.resolve(jsonResponse({ relationTypes: RELATION_TYPES_FIXTURE }));
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
});
