// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: useCurrentUserMock,
}));

const { LandingPage } = await import("@/features/landing/components/LandingPage");
const {
  HERO_TITLE_ACCENT,
  HERO_PRIMARY_CTA,
  HERO_SECONDARY_CTA,
  FEATURE_CARDS,
} = await import("@/features/landing/constants");

describe("LandingPage (루트 랜딩)", () => {
  it("비로그인 상태: 헤드라인·1차 CTA는 /explore, 2차 CTA는 returnTo로 로그인 유도", () => {
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    render(<LandingPage />);

    expect(screen.getByRole("heading", { level: 1, name: new RegExp(HERO_TITLE_ACCENT) })).toBeTruthy();

    // 히어로 + 최종 CTA 두 곳에 각 버튼이 존재
    const exploreLinks = screen.getAllByRole("link", { name: new RegExp(HERO_PRIMARY_CTA) });
    expect(exploreLinks.length).toBeGreaterThanOrEqual(1);
    exploreLinks.forEach((link) => expect(link.getAttribute("href")).toBe("/explore"));

    const createLinks = screen.getAllByRole("link", { name: HERO_SECONDARY_CTA });
    createLinks.forEach((link) =>
      expect(link.getAttribute("href")).toBe(
        `/auth/login?returnTo=${encodeURIComponent("/valuechains/new")}`,
      ),
    );
  });

  it("로그인 상태: 2차 CTA는 곧바로 생성 페이지로 이동", () => {
    useCurrentUserMock.mockReturnValue({
      status: "authenticated",
      user: { email: "a@b.com", role: "user" },
    });
    render(<LandingPage />);

    const createLinks = screen.getAllByRole("link", { name: HERO_SECONDARY_CTA });
    createLinks.forEach((link) => expect(link.getAttribute("href")).toBe("/valuechains/new"));
  });

  it("여섯 개 핵심 기능 카드를 모두 렌더한다", () => {
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    render(<LandingPage />);

    FEATURE_CARDS.forEach((card) => {
      expect(screen.getByRole("heading", { level: 3, name: card.title })).toBeTruthy();
    });
  });
});
