"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { IsoDate } from "@iib/domain";
import type { ApiError } from "@/lib/http/api-client";
import type { ChainViewAction } from "@/features/valuechains/state/chain-view.actions";
import type { ChainViewResponse, SnapshotAtResponse } from "@/features/valuechains/lib/dto";

/**
 * 구조(최신/시점) 쿼리 결과 → `TIMELINE_RESTORE_SUCCEEDED`/`FAILED` Action 변환 (UC-012 plan 모듈 15,
 * state_management §7.2). 이펙트는 현재 키의 쿼리만 관찰하고, reducer의 경합 가드가 2차 방어한다.
 */
export function useRestoreResultSync(input: {
  selectedDate: IsoDate | null;
  latestQuery: UseQueryResult<ChainViewResponse, ApiError>;
  snapshotAtQuery: UseQueryResult<SnapshotAtResponse, ApiError>;
  dispatch: Dispatch<ChainViewAction>;
  notifyRestoreFailure: (kind: "snapshot-not-found" | "error") => void;
}): void {
  const { selectedDate, latestQuery, snapshotAtQuery, dispatch, notifyRestoreFailure } = input;
  const lastHandledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedDate === null) {
      if (latestQuery.isSuccess) {
        const key = "latest:success";
        if (lastHandledKeyRef.current !== key) {
          lastHandledKeyRef.current = key;
          dispatch({ type: "TIMELINE_RESTORE_SUCCEEDED", payload: { date: null } });
        }
      }
      return;
    }

    if (snapshotAtQuery.isSuccess) {
      const key = `success:${selectedDate}`;
      if (lastHandledKeyRef.current !== key) {
        lastHandledKeyRef.current = key;
        dispatch({ type: "TIMELINE_RESTORE_SUCCEEDED", payload: { date: selectedDate } });
      }
      return;
    }

    if (snapshotAtQuery.isError) {
      const key = `error:${selectedDate}`;
      if (lastHandledKeyRef.current !== key) {
        lastHandledKeyRef.current = key;
        const kind = snapshotAtQuery.error?.code === "SNAPSHOT_NOT_FOUND" ? "snapshot-not-found" : "error";
        notifyRestoreFailure(kind);
        dispatch({ type: "TIMELINE_RESTORE_FAILED", payload: { failedDate: selectedDate } });
      }
    }
  }, [
    selectedDate,
    latestQuery.isSuccess,
    snapshotAtQuery.isSuccess,
    snapshotAtQuery.isError,
    snapshotAtQuery.error,
    dispatch,
    notifyRestoreFailure,
  ]);
}
