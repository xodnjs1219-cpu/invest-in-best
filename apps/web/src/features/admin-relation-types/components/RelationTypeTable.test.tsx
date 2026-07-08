// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminRelationTypeListItem } from "@/features/admin-relation-types/backend/schema";
import { EMPTY_LIST_MESSAGE, LIST_LOAD_ERROR_MESSAGE } from "@/features/admin-relation-types/constants";
import { RelationTypeTable } from "./RelationTypeTable";

const buildItem = (overrides: Partial<AdminRelationTypeListItem> = {}): AdminRelationTypeListItem => ({
  id: "rt-1",
  name: "공급",
  isDirected: true,
  isActive: true,
  isInUse: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  ...overrides,
});

const noop = () => {};

describe("RelationTypeTable (M11)", () => {
  it("빈 목록이면 빈 상태 안내를 표시한다", () => {
    render(
      <RelationTypeTable
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.getByText(EMPTY_LIST_MESSAGE)).toBeInTheDocument();
  });

  it("오류 상태면 오류 안내와 재시도 버튼을 표시하고 클릭 시 onRetry를 호출한다(E11)", () => {
    const onRetry = vi.fn();
    render(
      <RelationTypeTable
        items={[]}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.getByText(LIST_LOAD_ERROR_MESSAGE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("사용 중(isInUse=true) 행에 '사용 중' 배지를 표시한다", () => {
    render(
      <RelationTypeTable
        items={[buildItem({ isInUse: true })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.getByText("사용 중")).toBeInTheDocument();
  });

  it("활성 행은 이름 변경/비활성화 액션을 노출하고 재활성화는 노출하지 않는다", () => {
    render(
      <RelationTypeTable
        items={[buildItem({ isActive: true })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "이름 변경" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비활성화" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "재활성화" })).not.toBeInTheDocument();
  });

  it("비활성 행은 재활성화 액션과 비활성 배지를 노출한다", () => {
    render(
      <RelationTypeTable
        items={[buildItem({ isActive: false })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "재활성화" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "비활성화" })).not.toBeInTheDocument();
    expect(screen.getByText("비활성")).toBeInTheDocument();
  });

  it("어떤 행에도 삭제 버튼이 없다(E1)", () => {
    render(
      <RelationTypeTable
        items={[buildItem({ isActive: true }), buildItem({ id: "rt-2", isActive: false })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: /삭제/ })).not.toBeInTheDocument();
  });

  it("처리 중인 행(mutatingId)은 액션 버튼이 비활성화되고 다른 행은 그대로 유지된다", () => {
    render(
      <RelationTypeTable
        items={[buildItem({ id: "rt-1" }), buildItem({ id: "rt-2", name: "고객" })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId="rt-1"
        onRenameClick={noop}
        onDeactivateClick={noop}
        onReactivate={noop}
      />,
    );
    const renameButtons = screen.getAllByRole("button", { name: "이름 변경" });
    expect(renameButtons[0]).toBeDisabled();
    expect(renameButtons[1]).not.toBeDisabled();
  });

  it("비활성화 버튼 클릭 시 onDeactivateClick에 해당 항목이 전달된다", () => {
    const onDeactivateClick = vi.fn();
    const item = buildItem({ isActive: true });
    render(
      <RelationTypeTable
        items={[item]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        mutatingId={null}
        onRenameClick={noop}
        onDeactivateClick={onDeactivateClick}
        onReactivate={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    expect(onDeactivateClick).toHaveBeenCalledWith(item);
  });
});
