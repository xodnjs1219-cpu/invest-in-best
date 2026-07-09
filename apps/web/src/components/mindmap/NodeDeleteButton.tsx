import type { MouseEvent } from "react";

/**
 * 마인드맵 노드 우상단 삭제(×) 버튼 (편집 캔버스 전용).
 * `data.onDelete`가 주입된 노드에서만 렌더한다(뷰 캔버스는 미주입 → 미표시).
 * 노드 드래그/선택 제스처와 충돌하지 않도록 `nodrag`·이벤트 전파 차단을 적용한다.
 */
export function NodeDeleteButton({ onDelete, label }: { onDelete: () => void; label: string }) {
  const handleClick = (e: MouseEvent) => {
    // React Flow 노드 클릭/선택으로 버블링되지 않게 차단(삭제만 수행).
    e.stopPropagation();
    onDelete();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={label}
      title="노드 삭제"
      className="nodrag absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-raised text-fg-muted shadow-[var(--shadow-sm)] transition-colors hover:border-danger hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
