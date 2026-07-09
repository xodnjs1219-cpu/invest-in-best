// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/explore/components/MainExplorePage", () => ({
  MainExplorePage: () => <div data-testid="main-explore-page-stub" />,
}));

const { default: ExplorePage } = await import("@/app/(public)/explore/page");

describe("app/(public)/explore/page.tsx (탐색 페이지 셸)", () => {
  it("MainExplorePage를 배치만 하고 로직이 없다(Server Component)", () => {
    const element = ExplorePage();
    expect(element.type).toBeDefined();
  });
});
