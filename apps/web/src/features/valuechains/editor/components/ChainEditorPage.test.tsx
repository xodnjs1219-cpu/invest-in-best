// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ChainEditorPage } from "@/features/valuechains/editor/components/ChainEditorPage";

const stateMock = vi.hoisted(() => ({ current: null as unknown }));

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/valuechains/editor/context/ChainEditorContext")
  >("@/features/valuechains/editor/context/ChainEditorContext");
  return {
    ...actual,
    ChainEditorProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useChainEditorState: () => stateMock.current,
    useChainEditorActions: () => ({
      changeName: vi.fn(),
      changeFocusType: vi.fn(),
      setFocusSecurity: vi.fn(),
      clearFocusSecurity: vi.fn(),
      addListedCompanyNode: vi.fn(() => ({ ok: true })),
      addFreeSubjectNode: vi.fn(() => ({ ok: true })),
      moveNode: vi.fn(),
      deleteElements: vi.fn(),
      addEdge: vi.fn(() => ({ ok: true })),
      changeEdgeRelation: vi.fn(() => ({ ok: true })),
    }),
  };
});

function setState(overrides: {
  isBootstrapping?: boolean;
  entryBlocked?: { ownedChainCount: number; maxChainsPerUser: number } | null;
  bootstrapError?: { kind: "auth" | "network"; retry?: () => void } | null;
  initialized?: boolean;
}) {
  stateMock.current = {
    meta: { mode: "create", variant: "user" },
    state: {
      name: "",
      focusType: "industry",
      focusSecurity: null,
      isDirty: false,
      initialized: overrides.initialized ?? true,
      nodes: {},
      edges: {},
      groups: {},
      selection: { nodeIds: [], edgeIds: [] },
    },
    computed: {
      nodeCount: 0,
      nameIssue: null,
      remainingNodeCapacity: 100,
      isNearNodeLimit: false,
      relationTypeById: new Map(),
      activeRelationTypes: [],
      hasActiveRelationTypes: true,
    },
    async: {
      isBootstrapping: overrides.isBootstrapping ?? false,
      entryBlocked: overrides.entryBlocked ?? null,
      bootstrapError: overrides.bootstrapError ?? null,
    },
  };
}

describe("ChainEditorPage", () => {
  it("isBootstrapping이면 스켈레톤을 표시한다", () => {
    setState({ isBootstrapping: true });
    renderWithQueryClient(<ChainEditorPage mode="create" variant="user" />);
    expect(screen.getByTestId("editor-skeleton")).toBeInTheDocument();
  });

  it("entryBlocked이면 진입 차단 화면을 표시하고 캔버스는 렌더링하지 않는다", () => {
    setState({ entryBlocked: { ownedChainCount: 50, maxChainsPerUser: 50 } });
    renderWithQueryClient(<ChainEditorPage mode="create" variant="user" />);
    expect(screen.getByText("밸류체인 생성 상한 도달")).toBeInTheDocument();
  });

  it("bootstrapError kind=auth이면 재로그인 유도 화면을 표시한다", () => {
    setState({ bootstrapError: { kind: "auth" } });
    renderWithQueryClient(<ChainEditorPage mode="create" variant="user" />);
    expect(screen.getByText("로그인이 필요합니다")).toBeInTheDocument();
  });

  it("bootstrapError kind=network이면 재시도 버튼을 표시한다", () => {
    const retry = vi.fn();
    setState({ bootstrapError: { kind: "network", retry } });
    renderWithQueryClient(<ChainEditorPage mode="create" variant="user" />);
    screen.getByRole("button", { name: "재시도" }).click();
    expect(retry).toHaveBeenCalled();
  });

  it("initialized면 편집 UI(툴바·메타 패널·캔버스)를 표시한다", () => {
    setState({ initialized: true });
    renderWithQueryClient(<ChainEditorPage mode="create" variant="user" />);
    expect(screen.getByText("제목 없음")).toBeInTheDocument();
    expect(screen.getByLabelText("체인 이름")).toBeInTheDocument();
  });
});
