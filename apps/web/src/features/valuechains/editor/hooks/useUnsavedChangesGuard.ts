"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 미저장 이탈 가드 (UC-013 plan 모듈 12, E4).
 * `isDirty=true`일 때만: ① beforeunload 등록(탭 닫기/새로고침 네이티브 확인),
 * ② 내부 링크 클릭을 캡처해 자체 다이얼로그를 오픈(확인 시 원래 목적지로 이동, 취소 시 잔류).
 * 범용 훅(도메인 비의존) — 편집기 외 페이지 재사용 가능. 언마운트 시 리스너 전부 해제.
 */

export interface UnsavedChangesGuard {
  isLeaveDialogOpen: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuard {
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }
      event.preventDefault();
      pendingHrefRef.current = href;
      setIsLeaveDialogOpen(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    setIsLeaveDialogOpen(false);
    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    if (href) {
      window.location.href = href;
    }
  }, []);

  const cancelLeave = useCallback(() => {
    pendingHrefRef.current = null;
    setIsLeaveDialogOpen(false);
  }, []);

  return { isLeaveDialogOpen, confirmLeave, cancelLeave };
}
