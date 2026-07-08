"use client";

import { useState } from "react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" className="w-96 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900">공식 체인 저장</h2>
        <p className="mt-2 text-sm text-gray-600">저장 1회 = 스냅샷 1건으로 기록됩니다.</p>
        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="disclosure-date-input" className="text-sm font-medium text-gray-700">
            근거 공시일
          </label>
          <input
            id="disclosure-date-input"
            aria-label="근거 공시일"
            type="date"
            value={disclosureDate}
            onChange={(e) => setDisclosureDate(e.target.value)}
            disabled={isSaving}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <p className="text-xs text-gray-400">선택 사항입니다.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleConfirm}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
