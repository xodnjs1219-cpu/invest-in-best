import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/valuechains/editor/components/ChainEditorPage", () => ({
  ChainEditorPage: ({ mode, variant, chainId }: { mode: string; variant: string; chainId?: string }) => (
    <div data-testid="chain-editor-page" data-mode={mode} data-variant={variant} data-chain-id={chainId} />
  ),
}));

describe("/admin/valuechains/[chainId]/edit page", () => {
  it("ChainEditorPage(mode=edit, variant=official, chainId)를 렌더링한다", async () => {
    const { default: EditOfficialChainPage } = await import("./page");
    const element = await EditOfficialChainPage({ params: Promise.resolve({ chainId: "chain-1" }) });

    expect(element.props.mode).toBe("edit");
    expect(element.props.variant).toBe("official");
    expect(element.props.chainId).toBe("chain-1");
  });
});
