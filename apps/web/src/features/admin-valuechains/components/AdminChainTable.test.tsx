// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminChainTable } from "@/features/admin-valuechains/components/AdminChainTable";
import type { AdminChainListItem } from "@/features/admin-valuechains/backend/schema";

const buildChain = (overrides: Partial<AdminChainListItem> = {}): AdminChainListItem => ({
  chainId: "c1",
  name: "반도체 밸류체인",
  focusType: "industry",
  focusSecurityId: null,
  isArchived: false,
  latestSnapshot: {
    snapshotId: "s1",
    effectiveAt: "2026-07-05T09:00:00+09:00",
    changeSource: "admin_edit",
    nodeCount: 42,
  },
  createdAt: "2026-06-01T00:00:00+09:00",
  updatedAt: "2026-07-05T09:00:00+09:00",
  ...overrides,
});

describe("AdminChainTable", () => {
  it("행마다 이름·기준·노드 수·최근 변경(시각+출처)·상태 표시", () => {
    render(
      <AdminChainTable
        chains={[buildChain()]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        archivingChainId={null}
        onEdit={vi.fn()}
        onArchiveClick={vi.fn()}
      />,
    );
    expect(screen.getByText("반도체 밸류체인")).toBeInTheDocument();
    expect(screen.getByText("산업 중심")).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/관리자 편집/)).toBeInTheDocument();
  });

  it("공식 체인 0건 → 빈 상태 + 생성 유도 CTA", () => {
    render(
      <AdminChainTable
        chains={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        archivingChainId={null}
        onEdit={vi.fn()}
        onArchiveClick={vi.fn()}
      />,
    );
    expect(screen.getByText("공식 체인이 없습니다")).toBeInTheDocument();
  });

  it("보관 체인 행 → 보관 배지 표시, 편집/보관 버튼 미노출(R-6)", () => {
    render(
      <AdminChainTable
        chains={[buildChain({ isArchived: true, latestSnapshot: null })]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        archivingChainId={null}
        onEdit={vi.fn()}
        onArchiveClick={vi.fn()}
      />,
    );
    expect(screen.getByText("보관됨")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "보관" })).not.toBeInTheDocument();
  });

  it("활성 체인 행 → [편집]/[보관] 버튼 노출 + 클릭 시 콜백 호출", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onArchiveClick = vi.fn();
    render(
      <AdminChainTable
        chains={[buildChain()]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        archivingChainId={null}
        onEdit={onEdit}
        onArchiveClick={onArchiveClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "편집" }));
    expect(onEdit).toHaveBeenCalledWith("c1");

    await user.click(screen.getByRole("button", { name: "보관" }));
    expect(onArchiveClick).toHaveBeenCalledWith(buildChain());
  });

  it("로딩 상태 → 스켈레톤 표시", () => {
    render(
      <AdminChainTable
        chains={[]}
        isLoading={true}
        isError={false}
        onRetry={vi.fn()}
        archivingChainId={null}
        onEdit={vi.fn()}
        onArchiveClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("admin-chain-table-skeleton")).toBeInTheDocument();
  });

  it("오류 상태 → 재시도 버튼", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <AdminChainTable
        chains={[]}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
        archivingChainId={null}
        onEdit={vi.fn()}
        onArchiveClick={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
