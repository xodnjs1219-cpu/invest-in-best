// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "@/components/common/AppFooter";

describe("AppFooter", () => {
  it("면책 요약 문구(결정 G-2)를 표시한다", () => {
    render(<AppFooter />);
    expect(
      screen.getByText(/투자 판단의 참고 자료이며, 투자 권유가 아닙니다/),
    ).toBeInTheDocument();
  });

  it("이용약관 링크가 /legal/terms를 가리킨다(R-1)", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
  });

  it("개인정보처리방침 링크가 /legal/privacy를 가리킨다(R-1)", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
  });

  it("투자 면책 문구 링크가 /legal/disclaimer를 가리킨다(spec Main 2, 3종 완성)", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "투자 면책 문구" })).toHaveAttribute(
      "href",
      "/legal/disclaimer",
    );
  });

  it("정책 링크가 정확히 3종이다(BR-5)", () => {
    render(<AppFooter />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
