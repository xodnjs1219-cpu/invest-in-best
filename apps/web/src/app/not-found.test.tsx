// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("app/not-found.tsx (E2: 전역 404 안내)", () => {
  it("404 안내 문구를 표시한다", () => {
    render(<NotFound />);
    expect(screen.getByText(/페이지를 찾을 수 없습니다/)).toBeInTheDocument();
  });

  it("메인 복귀 링크가 / 를 가리킨다", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: /메인으로/ })).toHaveAttribute("href", "/");
  });
});
