// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/landing/components/LandingPage", () => ({
  LandingPage: () => <div data-testid="landing-page-stub" />,
}));

const { default: Home } = await import("@/app/page");

describe("app/page.tsx (루트 랜딩페이지 셸)", () => {
  it("LandingPage를 배치만 하고 로직이 없다(Server Component)", () => {
    const element = Home();
    expect(element.type).toBeDefined();
  });
});
