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

  it("이용약관 링크가 /terms를 가리킨다", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
  });

  it("개인정보처리방침 링크가 /privacy를 가리킨다", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
