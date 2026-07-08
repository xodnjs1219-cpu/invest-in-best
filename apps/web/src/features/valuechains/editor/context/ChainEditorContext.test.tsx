// @vitest-environment jsdom
import type { ReactNode } from "react";
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
});
