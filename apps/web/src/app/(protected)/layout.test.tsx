import { describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const createSsrServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server-client", () => ({
  createSsrServerClient: createSsrServerClientMock,
}));

describe("(protected)/layout", () => {
  it("세션이 없으면 /auth/login으로 redirect한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const { default: ProtectedLayout } = await import("./layout");

    await expect(ProtectedLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login");
  });

  it("세션이 있으면 children을 렌더링한다", async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [], set: () => {} });
    createSsrServerClientMock.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });

    const { default: ProtectedLayout } = await import("./layout");

    const result = await ProtectedLayout({ children: "content" });
    expect(result).toBe("content");
  });
});
