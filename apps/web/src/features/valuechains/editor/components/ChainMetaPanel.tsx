"use client";

import { useState } from "react";
import type { SecurityRef } from "@iib/domain";
import { MarketBadge } from "@/features/securities/components/SecurityBadges";
import {
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { FocusSecuritySearch } from "@/features/valuechains/editor/components/FocusSecuritySearch";

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
    <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="chain-name-input" className="text-sm font-medium text-gray-700">
          체인 이름
        </label>
        <input
          id="chain-name-input"
          aria-label="체인 이름"
          type="text"
          value={state.name}
          onChange={(e) => changeName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="밸류체인 이름을 입력하세요"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        {showNameError && <p className="text-xs text-red-600">이름을 입력하세요</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">기준</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="focus-type"
              checked={state.focusType === "industry"}
              onChange={() => changeFocusType("industry")}
            />
            산업 중심
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="focus-type"
              checked={state.focusType === "company"}
              onChange={() => changeFocusType("company")}
            />
            기업 중심
          </label>
        </div>
      </fieldset>

      {state.focusType === "company" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">대상 기업 지정은 선택 사항입니다</p>

          {state.focusSecurity ? (
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
              <span className="font-medium text-gray-900">{state.focusSecurity.name}</span>
              <span className="text-sm text-gray-500">{state.focusSecurity.ticker}</span>
              <MarketBadge market={state.focusSecurity.market} />
              <button
                type="button"
                onClick={clearFocusSecurity}
                aria-label="대상 기업 해제"
                className="ml-auto text-sm text-gray-400 hover:text-gray-600"
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
