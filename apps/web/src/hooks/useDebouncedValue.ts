"use client";

import { useEffect, useState } from "react";

/**
 * 범용 값 디바운스 훅 (UC-013 plan 모듈 13) — 검색 패널(FocusSecuritySearch) 등에서 공용으로 사용.
 * 값 변경 후 `delayMs` 경과 시 반영, 재변경 시 타이머 재시작, 언마운트 시 취소.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
