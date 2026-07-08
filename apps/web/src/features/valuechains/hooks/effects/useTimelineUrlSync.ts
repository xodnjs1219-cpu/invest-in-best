"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IsoDate } from "@iib/domain";

/**
 * S2(lastAppliedDate) → URL `?at=` 단방향 미러 (UC-012 plan 모듈 14, state_management §7.1).
 * 복원 **성공 시에만** URL이 갱신되고, 실패 시 URL은 변경된 적이 없으므로 자동 원복된다.
 * `hasRestoreConcluded=false`(딥링크 최초 진입 미확정) 동안은 동기화를 보류해 `?at=`을 보존한다.
 */
export function useTimelineUrlSync(input: {
  lastAppliedDate: IsoDate | null;
  hasRestoreConcluded: boolean;
}): void {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!input.hasRestoreConcluded) {
      return;
    }
    const current = searchParams.get("at");
    const next = input.lastAppliedDate;

    if (current === next) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (next === null) {
      params.delete("at");
    } else {
      params.set("at", next);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.hasRestoreConcluded, input.lastAppliedDate]);
}
