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
  ChainEditorPage: ({ mode, variant }: { mode: string; variant: string }) => (
    <div data-testid="chain-editor-page" data-mode={mode} data-variant={variant} />
  ),
}));

describe("/valuechains/new page", () => {
  it("세션이 없으면 returnTo=/valuechains/new로 리다이렉트한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const { default: NewChainPage } = await import("./page");

    await expect(NewChainPage()).rejects.toThrow(
      "REDIRECT:/auth/login?returnTo=%2Fvaluechains%2Fnew",
    );
  });

  it("세션이 있으면 ChainEditorPage(mode=create, variant=user)를 렌더링한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });

    const { default: NewChainPage } = await import("./page");
    const element = await NewChainPage();

    expect(element.props.mode).toBe("create");
    expect(element.props.variant).toBe("user");
  });
});
