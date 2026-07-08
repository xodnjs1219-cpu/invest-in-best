"use client";

import Link from "next/link";
import { CloneChainButton } from "@/features/valuechains/components/CloneChainButton";
import { DeleteChainButton } from "@/features/valuechains/components/DeleteChainButton";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

/**
 * 체인 뷰 헤더 (plan 모듈 C6) — 체인명, 체인 종류/기준 표기, 편집 진입 링크(isOwner일 때만).
 * 편집 화면 자체는 UC-015~018 범위 — 여기서는 이동 링크만 제공한다.
 * UC-014: 공식 체인(chainType='official')일 때만 복제 버튼을 노출한다(복제 대상 제한, BR-1).
 * UC-019: isOwner=true(본인 소유 사용자 체인)일 때만 삭제 버튼을 노출한다.
 */
export const ChainViewHeader = () => {
  const { chainId, structure, isOwner } = useChainViewState();

  if (structure.status !== "ready") {
    return (
      <header className="mb-4 flex items-center justify-between">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
      </header>
    );
  }

  const { chain } = structure.data;

  return (
    <header className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{chain.name}</h1>
        {chain.focusType === "company" && chain.focusSecurity && (
          <p className="mt-0.5 text-sm text-gray-500">
            {chain.focusSecurity.ticker} · {chain.focusSecurity.name}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {chain.chainType === "official" && <CloneChainButton chainId={chainId} variant="header" />}
        {isOwner && (
          <>
            <Link
              href={`/valuechains/${chainId}/edit`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              편집
            </Link>
            <DeleteChainButton
              chainId={chainId}
              chainName={chain.name}
              source="view"
              variant="header"
            />
          </>
        )}
      </div>
    </header>
  );
};
