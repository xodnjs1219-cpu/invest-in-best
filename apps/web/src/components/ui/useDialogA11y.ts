"use client";

import { useEffect, useRef } from "react";

/**
 * 모달 다이얼로그 접근성 훅 (WAI-ARIA APG Dialog 패턴, WCAG 2.1.2/2.4.3).
 * - 열릴 때: 첫 포커서블 요소로 초기 포커스, body 스크롤 잠금
 * - 열린 동안: Tab/Shift+Tab 포커스 트랩, Escape로 onClose
 * - 닫힐 때: 트리거(이전 activeElement)로 포커스 복원, 스크롤 잠금 해제
 * 반환된 ref를 다이얼로그 루트(role="dialog" 요소)에 부여한다.
 * `open`을 받아 effect가 열림/닫힘에 반응한다(컴포넌트가 open=false로 마운트된 채 토글되는 구조 지원).
 * onClose는 ref로 참조하므로 콜백 아이덴티티가 바뀌어도 포커스가 튀지 않는다.
 */
export function useDialogA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // 최신 onClose를 ref에 보관(렌더 중 ref 쓰기 금지 규칙 준수) — 트랩 effect는 open에만 반응한다.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(focusables());
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      prev?.focus();
    };
  }, [open]);

  return ref;
}
