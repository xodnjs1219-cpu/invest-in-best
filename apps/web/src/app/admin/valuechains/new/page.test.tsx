import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/valuechains/editor/components/ChainEditorPage", () => ({
  ChainEditorPage: ({ mode, variant, chainId }: { mode: string; variant: string; chainId?: string }) => (
    <div data-testid="chain-editor-page" data-mode={mode} data-variant={variant} data-chain-id={chainId} />
  ),
}));

describe("/admin/valuechains/new page", () => {
  it("ChainEditorPage(mode=create, variant=official)를 렌더링한다(chainId 없음)", async () => {
    const { default: NewOfficialChainPage } = await import("./page");
    const element = NewOfficialChainPage();

    expect(element.props.mode).toBe("create");
    expect(element.props.variant).toBe("official");
    expect(element.props.chainId).toBeUndefined();
  });
});
