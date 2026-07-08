// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { BelongingChainsSection } from "@/features/companies/components/BelongingChainsSection";
import { CHAINS_EMPTY_MESSAGE, CHAINS_SECTION_ERROR_MESSAGE, CHAINS_SUMMARY_PENDING_LABEL } from "@/features/companies/constants";
import type { CompanyValuechainsResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

const buildQuery = (
  overrides: Partial<UseQueryResult<CompanyValuechainsResponse, ApiError>>,
): UseQueryResult<CompanyValuechainsResponse, ApiError> =>
  ({
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }) as UseQueryResult<CompanyValuechainsResponse, ApiError>;

describe("BelongingChainsSection", () => {
  it("로딩 중이면 스켈레톤을 표시한다", () => {
    render(<BelongingChainsSection query={buildQuery({ isPending: true })} />);
    expect(screen.getByTestId("chains-loading")).toBeInTheDocument();
  });

  it("오류면 폴백+재시도 버튼을 표시한다", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <BelongingChainsSection
        query={buildQuery({ isError: true, error: new ApiError("CHAINS_FETCH_ERROR", 500, "오류"), refetch })}
      />,
    );

    expect(screen.getByText(CHAINS_SECTION_ERROR_MESSAGE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("공식 체인 2개만 있으면 2행을 표시한다(비로그인)", () => {
    render(
      <BelongingChainsSection
        query={buildQuery({
          data: {
            securityId: "sec-1",
            items: [
              { chainId: "c1", name: "반도체", chainType: "official", focusType: "industry", nodeCount: 5, summary: null },
              { chainId: "c2", name: "2차전지", chainType: "official", focusType: "industry", nodeCount: 3, summary: null },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("반도체")).toBeInTheDocument();
    expect(screen.getByText("2차전지")).toBeInTheDocument();
  });

  it("로그인 시 '내 체인' 배지 행이 표시된다(E12)", () => {
    render(
      <BelongingChainsSection
        query={buildQuery({
          data: {
            securityId: "sec-1",
            items: [
              { chainId: "c1", name: "나만의 밸류체인", chainType: "user", focusType: "company", nodeCount: 2, summary: null },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("나만의 밸류체인")).toBeInTheDocument();
    expect(screen.getByText("내 체인")).toBeInTheDocument();
  });

  it("체인 행 클릭 시 밸류체인 뷰로 이동하는 링크를 갖는다", () => {
    render(
      <BelongingChainsSection
        query={buildQuery({
          data: {
            securityId: "sec-1",
            items: [
              { chainId: "chain-abc", name: "반도체", chainType: "official", focusType: "industry", nodeCount: 5, summary: null },
            ],
          },
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /반도체/ });
    expect(link).toHaveAttribute("href", "/valuechains/chain-abc");
  });

  it("summary: null이면 '집계 준비 중'을 표시한다", () => {
    render(
      <BelongingChainsSection
        query={buildQuery({
          data: {
            securityId: "sec-1",
            items: [
              { chainId: "c1", name: "반도체", chainType: "official", focusType: "industry", nodeCount: 5, summary: null },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText(CHAINS_SUMMARY_PENDING_LABEL)).toBeInTheDocument();
  });

  it("items: []이면 빈 목록 안내를 표시한다(E11)", () => {
    render(<BelongingChainsSection query={buildQuery({ data: { securityId: "sec-1", items: [] } })} />);
    expect(screen.getByText(CHAINS_EMPTY_MESSAGE)).toBeInTheDocument();
  });
});
