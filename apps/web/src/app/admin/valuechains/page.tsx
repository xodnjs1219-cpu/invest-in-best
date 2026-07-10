"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Heading } from "@/components/ui";
import { ArchiveChainDialog, type ArchiveChainTarget } from "@/features/admin-valuechains/components/ArchiveChainDialog";
import { AdminChainTable } from "@/features/admin-valuechains/components/AdminChainTable";
import { ADMIN_CHAIN_LIST_TEXT, ARCHIVE_TOAST_TEXT } from "@/features/admin-valuechains/constants";
import { useAdminChains } from "@/features/admin-valuechains/hooks/useAdminChains";
import { useArchiveChain } from "@/features/admin-valuechains/hooks/useArchiveChain";

type Toast = { variant: "success" | "error"; message: string } | null;

/**
 * `/admin/valuechains` 페이지 컨테이너(UC-021 plan 모듈 M16). 어드민 레이아웃 가드는
 * `app/admin/layout.tsx`(UC-022 M2)가 담당하며, 본 페이지는 재검증하지 않는다 —
 * API 미들웨어(`withAdminAuth`)가 인가의 진실이다. 페이지 상태 문서가 없는 단순 목록이므로
 * Context+useReducer 불요(UC-001 plan 선례).
 */
export default function AdminValuechainsPage() {
  const router = useRouter();
  const [archiveTarget, setArchiveTarget] = useState<ArchiveChainTarget | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const listQuery = useAdminChains();
  const archiveMutation = useArchiveChain();

  const chains = listQuery.data?.chains ?? [];

  const showToast = (variant: "success" | "error", message: string) => {
    setToast({ variant, message });
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleArchiveConfirm = () => {
    if (!archiveTarget) {
      return;
    }
    archiveMutation.mutate(
      { chainId: archiveTarget.chainId },
      {
        onSuccess: () => {
          setArchiveTarget(null);
          showToast("success", ARCHIVE_TOAST_TEXT.success);
        },
        onError: () => {
          setArchiveTarget(null);
          showToast("error", ARCHIVE_TOAST_TEXT.failure);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Heading level={1}>{ADMIN_CHAIN_LIST_TEXT.pageTitle}</Heading>
        <Button variant="primary" size="sm" onClick={() => router.push("/admin/valuechains/new")}>
          {ADMIN_CHAIN_LIST_TEXT.createCta}
        </Button>
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-[var(--radius)] px-4 py-2 text-sm text-accent-fg shadow-elevated ${
            toast.variant === "success" ? "bg-success" : "bg-danger"
          }`}
        >
          {toast.message}
        </div>
      )}

      <AdminChainTable
        chains={chains}
        isLoading={listQuery.isPending}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        archivingChainId={archiveMutation.isPending ? (archiveMutation.variables?.chainId ?? null) : null}
        onEdit={(chainId) => router.push(`/admin/valuechains/${chainId}/edit`)}
        onArchiveClick={(chain) => setArchiveTarget({ chainId: chain.chainId, name: chain.name })}
      />

      <ArchiveChainDialog
        target={archiveTarget}
        isArchiving={archiveMutation.isPending}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
