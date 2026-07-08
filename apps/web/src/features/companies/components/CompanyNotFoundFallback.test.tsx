// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyNotFoundFallback } from "@/features/companies/components/CompanyNotFoundFallback";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/features/companies/constants";

describe("CompanyNotFoundFallback", () => {
  it("안내 문구와 메인/검색 링크를 표시한다", () => {
    render(<CompanyNotFoundFallback />);

    expect(screen.getByText(COMPANY_NOT_FOUND_MESSAGE)).toBeInTheDocument();
    const homeLink = screen.getByRole("link", { name: /메인/ });
    expect(homeLink).toHaveAttribute("href", "/");
    const searchLink = screen.getByRole("link", { name: /검색/ });
    expect(searchLink).toHaveAttribute("href", "/securities/search");
  });
});
