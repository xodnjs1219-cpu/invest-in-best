"use client";

import { useState } from "react";
import { Button, Card, Heading, Input, useDialogA11y } from "@/components/ui";

export interface OfficialSaveDialogProps {
  open: boolean;
  isSaving: boolean;
  onConfirm: (disclosureDate: string | null) => void;
  onCancel: () => void;
}

/**
 * 공식 체인 저장 다이얼로그(UC-021 plan 모듈 M21) — 순수 Presenter.
 * "저장 1회 = 스냅샷 1건" 안내 + 근거 공시일(선택) 입력(BR-2 메타데이터, R-8 — 로컬 상태만).
 * 빈 입력 확정 → disclosureDate=null. 저장 중에는 dismiss 차단(중복 전송 방지).
 */
export function OfficialSaveDialog({ open, isSaving, onConfirm, onCancel }: OfficialSaveDialogProps) {
  const [disclosureDate, setDisclosureDate] = useState("");

  // 저장 중에는 Escape로도 닫히지 않는다(중복 전송 방지 — handleCancel과 동일 가드).
  const dialogRef = useDialogA11y(open, () => {
    if (!isSaving) onCancel();
  });

  if (!open) {
    return null;
  }

  const handleCancel = () => {
    if (isSaving) {
      return;
    }
    onCancel();
  };

  const handleConfirm = () => {
    const trimmed = disclosureDate.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-save-dialog-title"
        className="panel-enter w-full max-w-sm bg-surface-raised p-6"
      >
        <Heading level={3} id="official-save-dialog-title">
          공식 체인 저장
        </Heading>
        <p className="mt-2 text-sm text-fg-muted">저장 1회 = 스냅샷 1건으로 기록됩니다.</p>
        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="disclosure-date-input" className="text-sm text-fg-muted">
            근거 공시일
          </label>
          <Input
            id="disclosure-date-input"
            aria-label="근거 공시일"
            type="date"
            value={disclosureDate}
            onChange={(e) => setDisclosureDate(e.target.value)}
            disabled={isSaving}
          />
          <p className="text-xs text-fg-subtle">선택 사항입니다.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
            취소
          </Button>
          <Button type="button" size="sm" disabled={isSaving} onClick={handleConfirm}>
            저장
          </Button>
        </div>
      </Card>
    </div>
  );
}
