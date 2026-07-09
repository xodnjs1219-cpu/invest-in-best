"use client";

import { useState, type ReactNode } from "react";
import type { SecurityRef } from "@iib/domain";
import { MarketBadge } from "@/features/securities/components/SecurityBadges";
import {
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { FocusSecuritySearch } from "@/features/valuechains/editor/components/FocusSecuritySearch";
import { Input } from "@/components/ui";

type FocusType = "industry" | "company";

/** 기준(focusType) 선택 카드 정의 — 라벨/설명/아이콘. label은 테스트가 참조하는 접근 가능한 이름이다. */
const FOCUS_TYPE_OPTIONS: ReadonlyArray<{
  value: FocusType;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    value: "industry",
    label: "산업 중심",
    description: "산업 전반의 공급·수요 구조를 그립니다",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M6.7 7.3 10.6 16.3M17.3 7.3 13.4 16.3M7 6h10" />
      </svg>
    ),
  },
  {
    value: "company",
    label: "기업 중심",
    description: "특정 기업을 축으로 관계를 확장합니다",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
        <path d="M15 9h4a1 1 0 0 1 1 1v11M4 21h16" />
        <path d="M7.5 8h1M11 8h1M7.5 12h1M11 12h1M7.5 16h1M11 16h1" />
      </svg>
    ),
  },
];

/**
 * 메타 패널 (UC-013 plan 모듈 19) — 이름 입력 + 기준 토글(industry/company) + 대상 기업 칩.
 * 필드 터치 여부는 로컬 상태(문서 상태 아님) — 오류 표시 타이밍 전용.
 */
export function ChainMetaPanel() {
  const { state, computed } = useChainEditorState();
  const { changeName, changeFocusType, setFocusSecurity, clearFocusSecurity } = useChainEditorActions();
  const [nameTouched, setNameTouched] = useState(false);

  const showNameError = nameTouched && computed.nameIssue === "NAME_REQUIRED";

  const handleSelectSecurity = (security: SecurityRef) => {
    setFocusSecurity(security);
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border px-4 py-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="chain-name-input" className="text-sm font-medium text-fg-muted">
          체인 이름
        </label>
        <Input
          id="chain-name-input"
          aria-label="체인 이름"
          type="text"
          value={state.name}
          onChange={(e) => changeName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="밸류체인 이름을 입력하세요"
        />
        {showNameError && <p className="text-xs text-danger">이름을 입력하세요</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-fg-muted">기준</legend>
        {/* 세그먼트형 선택 카드 — 실제 radio는 sr-only로 숨겨 role/접근성/키보드 탐색을 유지하고,
            label을 클릭 가능한 카드로 스타일링한다(peer-checked로 선택 상태를 강조). */}
        <div className="grid grid-cols-2 gap-2">
          {FOCUS_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="group relative flex cursor-pointer flex-col gap-1 rounded-[var(--radius-lg)] border border-border bg-surface-raised p-3 transition-colors hover:border-border-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="focus-type"
                aria-label={option.label}
                className="peer sr-only"
                checked={state.focusType === option.value}
                onChange={() => changeFocusType(option.value)}
              />
              <span className="flex items-center gap-2">
                <span className="text-fg-subtle peer-checked:text-accent group-has-[:checked]:text-accent">
                  {option.icon}
                </span>
                <span className="text-sm font-semibold text-fg">{option.label}</span>
              </span>
              <span className="text-xs leading-snug text-fg-muted">{option.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.focusType === "company" && (
        <div className="flex w-full max-w-md flex-col gap-2">
          <p className="text-xs text-fg-muted">대상 기업 지정은 선택 사항입니다</p>

          {state.focusSecurity ? (
            <div className="flex items-center gap-2 rounded-[var(--radius)] bg-surface-sunken px-3 py-2">
              <span className="font-medium text-fg">{state.focusSecurity.name}</span>
              <span className="text-sm text-fg-muted">{state.focusSecurity.ticker}</span>
              <MarketBadge market={state.focusSecurity.market} />
              <button
                type="button"
                onClick={clearFocusSecurity}
                aria-label="대상 기업 해제"
                className="ml-auto text-sm text-fg-subtle hover:text-fg-muted"
              >
                해제 ×
              </button>
            </div>
          ) : (
            <FocusSecuritySearch onSelect={handleSelectSecurity} />
          )}
        </div>
      )}
    </div>
  );
}
