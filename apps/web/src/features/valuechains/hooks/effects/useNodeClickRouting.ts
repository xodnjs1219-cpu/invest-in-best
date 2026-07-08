"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { IsoDate } from "@iib/domain";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ApiError } from "@/lib/http/api-client";
import { buildCompanyDetailPath } from "@/lib/routes";
import type { ChainViewAction } from "@/features/valuechains/state/chain-view.actions";
import type { NodeDetailResponse } from "@/features/valuechains/lib/dto";

/**
 * 노드 상세 결과 → 상장기업 노드 분기 라우팅 이펙트 (UC-011 plan 모듈 14, state_management §7.3).
 * 상장기업 노드(종목 해석 성공)일 때만 동작: 패널을 닫고 기업 상세로 이동한다.
 * 과거 시점 조회 중이면 `?asOf=`를 부여해 시점 컨텍스트 안내를 트리거한다(E3).
 * 중복 라우팅 가드(E10): 동일 nodeId에 대해 1회만 라우팅하고, selectedNodeId가 null로 바뀌면 리셋한다.
 */
export function useNodeClickRouting(input: {
  selectedNodeId: string | null;
  nodeDetailQuery: UseQueryResult<NodeDetailResponse, ApiError>;
  selectedDate: IsoDate | null;
  dispatch: Dispatch<ChainViewAction>;
  router: Pick<AppRouterInstance, "push">;
}): void {
  const { selectedNodeId, nodeDetailQuery, selectedDate, dispatch, router } = input;
  const routedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedNodeId === null) {
      routedNodeIdRef.current = null;
      return;
    }

    if (!nodeDetailQuery.isSuccess) {
      return;
    }

    const data = nodeDetailQuery.data;
    if (data.nodeId !== selectedNodeId) {
      return;
    }
    if (data.nodeKind !== "listed_company" || !data.securityResolved || !data.security) {
      return;
    }
    if (routedNodeIdRef.current === selectedNodeId) {
      return;
    }
    routedNodeIdRef.current = selectedNodeId;

    dispatch({ type: "NODE_PANEL_CLOSED" });
    router.push(
      buildCompanyDetailPath({
        ticker: data.security.ticker,
        market: data.security.market,
        asOf: selectedDate,
      }),
    );
  }, [selectedNodeId, nodeDetailQuery.isSuccess, nodeDetailQuery.data, selectedDate, dispatch, router]);
}
