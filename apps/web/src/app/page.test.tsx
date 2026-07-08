// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/explore/components/MainExplorePage", () => ({
  MainExplorePage: () => <div data-testid="main-explore-page-stub" />,
}));

const { default: Home } = await import("@/app/page");

describe("app/page.tsx (메인/탐색 페이지 셸)", () => {
  it("MainExplorePage를 배치만 하고 로직이 없다(Server Component)", () => {
    const element = Home();
    expect(element.type).toBeDefined();
  });
});
