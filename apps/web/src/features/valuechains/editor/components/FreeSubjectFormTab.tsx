"use client";

import { useState } from "react";
import type { FreeSubjectType } from "@iib/domain";

const SUBJECT_TYPE_OPTIONS: { value: FreeSubjectType; label: string }[] = [
  { value: "consumer", label: "소비자" },
  { value: "government", label: "정부" },
  { value: "private_company", label: "비상장기업" },
  { value: "other", label: "기타" },
];

export interface FreeSubjectFormTabProps {
  onAdd: (input: { subjectType: FreeSubjectType; subjectName: string; subjectMemo: string | null }) => void;
  disabled: boolean;
}

/**
 * 자유 주체 노드 추가 폼(UC-015 plan 모듈 20) — 유형·이름(필수)·메모(선택) 입력.
 * 필드 단위 인라인 오류(E9) + 노드 상한 도달 시 제출 비활성(E1, disabled prop으로 호출측이 제어).
 */
export function FreeSubjectFormTab({ onAdd, disabled }: FreeSubjectFormTabProps) {
  const [subjectType, setSubjectType] = useState<FreeSubjectType | "">("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectMemo, setSubjectMemo] = useState("");
  const [typeError, setTypeError] = useState(false);
  const [nameError, setNameError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = subjectName.trim();
    const hasTypeError = subjectType === "";
    const hasNameError = trimmedName.length === 0;

    setTypeError(hasTypeError);
    setNameError(hasNameError);

    if (hasTypeError || hasNameError) {
      return;
    }

    const trimmedMemo = subjectMemo.trim();
    onAdd({
      subjectType: subjectType as FreeSubjectType,
      subjectName: trimmedName,
      subjectMemo: trimmedMemo.length > 0 ? trimmedMemo : null,
    });

    setSubjectType("");
    setSubjectName("");
    setSubjectMemo("");
    setTypeError(false);
    setNameError(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="free-subject-type" className="text-sm font-medium text-gray-700">
          유형
        </label>
        <select
          id="free-subject-type"
          aria-label="유형"
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value as FreeSubjectType)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">선택하세요</option>
          {SUBJECT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {typeError && <p className="text-xs text-red-600">유형을 선택하세요</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="free-subject-name" className="text-sm font-medium text-gray-700">
          이름
        </label>
        <input
          id="free-subject-name"
          aria-label="이름"
          type="text"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        {nameError && <p className="text-xs text-red-600">이름을 입력하세요</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="free-subject-memo" className="text-sm font-medium text-gray-700">
          설명 메모
        </label>
        <textarea
          id="free-subject-memo"
          aria-label="설명 메모"
          value={subjectMemo}
          onChange={(e) => setSubjectMemo(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300"
      >
        추가
      </button>
    </form>
  );
}
