import { describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);
const createSsrServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server-client", () => ({
  createSsrServerClient: createSsrServerClientMock,
}));
vi.mock("@/features/valuechains/editor/components/ChainEditorPage", () => ({
  ChainEditorPage: ({ mode, variant, chainId }: { mode: string; variant: string; chainId?: string }) => (
    <div data-testid="chain-editor-page" data-mode={mode} data-variant={variant} data-chain-id={chainId} />
  ),
}));

describe("/valuechains/[chainId]/edit page", () => {
  it("세션이 없으면 returnTo와 함께 로그인 페이지로 리다이렉트한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const { default: EditChainPage } = await import("./page");

    await expect(EditChainPage({ params: Promise.resolve({ chainId: "chain-1" }) })).rejects.toThrow(
      "REDIRECT:/auth/login?returnTo=%2Fvaluechains%2Fchain-1%2Fedit",
    );
  });

  it("세션이 있으면 ChainEditorPage(mode=edit, variant=user, chainId)를 렌더링한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });

    const { default: EditChainPage } = await import("./page");
    const element = await EditChainPage({ params: Promise.resolve({ chainId: "chain-1" }) });

    expect(element.props.mode).toBe("edit");
    expect(element.props.variant).toBe("user");
    expect(element.props.chainId).toBe("chain-1");
  });
});
