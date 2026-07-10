"use client";

import { useState } from "react";
import { Button, Heading } from "@/components/ui";
import { ApiError } from "@/lib/http/api-client";
import { DeactivateConfirmDialog } from "@/features/admin-relation-types/components/DeactivateConfirmDialog";
import { RelationTypeFormDialog, type RelationTypeFormValues } from "@/features/admin-relation-types/components/RelationTypeFormDialog";
import { RelationTypeTable } from "@/features/admin-relation-types/components/RelationTypeTable";
import { ADD_BUTTON_LABEL, FIELD_ERROR_MESSAGES, PAGE_TITLE, TOAST_MESSAGES } from "@/features/admin-relation-types/constants";
import { useAdminRelationTypes } from "@/features/admin-relation-types/hooks/useAdminRelationTypes";
import { useCreateRelationType } from "@/features/admin-relation-types/hooks/useCreateRelationType";
import { useUpdateRelationType } from "@/features/admin-relation-types/hooks/useUpdateRelationType";
import type { AdminRelationTypeListItem } from "@/features/admin-relation-types/backend/schema";

type DialogState =
  | { kind: "create" }
  | { kind: "rename"; target: AdminRelationTypeListItem }
  | { kind: "deactivate"; target: AdminRelationTypeListItem }
  | null;

type Toast = { variant: "success" | "error"; message: string } | null;

const toastStyles: Record<"success" | "error", string> = {
  success: "bg-success",
  error: "bg-danger",
};

/**
 * `/admin/relation-types` 페이지 컨테이너(plan M14). 어드민 레이아웃 가드는
 * `app/admin/layout.tsx`(UC-022 M2)가 담당하며, 본 페이지는 재검증하지 않는다 —
 * API 미들웨어(`withAdminAuth`)가 인가의 진실이다.
 */
export default function AdminRelationTypesPage() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useAdminRelationTypes();
  const createMutation = useCreateRelationType();
  const updateMutation = useUpdateRelationType();

  const items = listQuery.data?.relationTypes ?? [];
  const mutatingId = updateMutation.isPending ? (updateMutation.variables?.id ?? null) : null;

  const showToast = (variant: "success" | "error", message: string) => {
    setToast({ variant, message });
    window.setTimeout(() => setToast(null), 4000);
  };

  const closeDialog = () => {
    setDialog(null);
    setFormError(null);
  };

  const handleCreateSubmit = (values: RelationTypeFormValues) => {
    setFormError(null);
    createMutation.mutate(
      { name: values.name, isDirected: values.isDirected },
      {
        onSuccess: () => {
          closeDialog();
          showToast("success", TOAST_MESSAGES.createSuccess);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "RELATION_TYPE_NAME_DUPLICATE") {
            setFormError(FIELD_ERROR_MESSAGES.nameDuplicate);
            return;
          }
          showToast("error", TOAST_MESSAGES.retryGuidance);
        },
      },
    );
  };

  const handleRenameSubmit = (values: RelationTypeFormValues) => {
    if (dialog?.kind !== "rename") {
      return;
    }
    setFormError(null);
    updateMutation.mutate(
      { id: dialog.target.id, patch: { name: values.name } },
      {
        onSuccess: () => {
          closeDialog();
          showToast("success", TOAST_MESSAGES.renameSuccess);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "RELATION_TYPE_NAME_DUPLICATE") {
            setFormError(FIELD_ERROR_MESSAGES.nameDuplicate);
            return;
          }
          if (error instanceof ApiError && error.code === "RELATION_TYPE_NOT_FOUND") {
            closeDialog();
            showToast("error", TOAST_MESSAGES.notFoundRetry);
            return;
          }
          showToast("error", TOAST_MESSAGES.retryGuidance);
        },
      },
    );
  };

  const handleDeactivateConfirm = (id: string) => {
    updateMutation.mutate(
      { id, patch: { isActive: false } },
      {
        onSuccess: () => {
          closeDialog();
          showToast("success", TOAST_MESSAGES.deactivateSuccess);
        },
        onError: (error) => {
          closeDialog();
          if (error instanceof ApiError && error.code === "RELATION_TYPE_NOT_FOUND") {
            showToast("error", TOAST_MESSAGES.notFoundRetry);
            return;
          }
          showToast("error", TOAST_MESSAGES.retryGuidance);
        },
      },
    );
  };

  const handleReactivate = (item: AdminRelationTypeListItem) => {
    updateMutation.mutate(
      { id: item.id, patch: { isActive: true } },
      {
        onSuccess: () => showToast("success", TOAST_MESSAGES.reactivateSuccess),
        onError: (error) => {
          if (error instanceof ApiError && error.code === "RELATION_TYPE_NOT_FOUND") {
            showToast("error", TOAST_MESSAGES.notFoundRetry);
            return;
          }
          showToast("error", TOAST_MESSAGES.retryGuidance);
        },
      },
    );
  };

  const deactivateTarget =
    dialog?.kind === "deactivate"
      ? { id: dialog.target.id, name: dialog.target.name, isInUse: dialog.target.isInUse }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Heading level={1}>{PAGE_TITLE}</Heading>
        <Button variant="primary" size="sm" onClick={() => setDialog({ kind: "create" })}>
          {ADD_BUTTON_LABEL}
        </Button>
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-[var(--radius)] px-4 py-2 text-sm text-accent-fg shadow-elevated ${toastStyles[toast.variant]}`}
        >
          {toast.message}
        </div>
      )}

      <RelationTypeTable
        items={items}
        isLoading={listQuery.isPending}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        mutatingId={mutatingId}
        onRenameClick={(item) => setDialog({ kind: "rename", target: item })}
        onDeactivateClick={(item) => setDialog({ kind: "deactivate", target: item })}
        onReactivate={handleReactivate}
      />

      {(dialog?.kind === "create" || dialog?.kind === "rename") && (
        <RelationTypeFormDialog
          mode={dialog.kind}
          target={dialog.kind === "rename" ? { id: dialog.target.id, name: dialog.target.name } : undefined}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          serverErrorMessage={formError}
          onSubmit={dialog.kind === "create" ? handleCreateSubmit : handleRenameSubmit}
          onCancel={closeDialog}
        />
      )}

      <DeactivateConfirmDialog
        target={deactivateTarget}
        isSubmitting={updateMutation.isPending}
        onConfirm={handleDeactivateConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
