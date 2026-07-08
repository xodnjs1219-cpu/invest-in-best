/**
 * LLM 응답 DTO/스키마 (docs/usecases/030/plan.md 모듈 5).
 * 봉투(envelope) 파싱 실패는 재시도 대상(R-7), 개별 제안 항목의 스키마 위반은 그 항목만 드롭한다.
 */
import { z } from "zod";
import { LLM_PROPOSAL_TYPES, type LlmProposalCandidate } from "@iib/domain";
import type { AliasMaps } from "./prompt";

/** 봉투 스키마 — `proposals` 배열 존재만 확인(항목 세부는 아래 항목 스키마가 개별 검증, R-7). */
export const llmEnvelopeSchema = z.object({
  proposals: z.array(z.unknown()),
});

/** 항목 스키마 — F-1: 전 유형(add/update/delete) 관계 종류 별칭 필수. */
export const llmProposalItemSchema = z.object({
  proposalType: z.enum(LLM_PROPOSAL_TYPES),
  sourceNodeAlias: z.string(),
  targetNodeAlias: z.string(),
  relationTypeAlias: z.string(),
  rationale: z.string().min(1),
});

export interface MapItemsToCandidatesResult {
  candidates: LlmProposalCandidate[];
  droppedItemCount: number;
}

/**
 * 항목별 safeParse + 별칭→UUID 역매핑. 스키마 위반이거나 별칭이 aliasMaps에 없으면 드롭 카운트만
 * 증가시키고 계속 진행한다(환각 방어, R-7 — 전체 재시도로 이어지지 않음).
 */
export function mapItemsToCandidates(
  items: readonly unknown[],
  aliasMaps: AliasMaps,
): MapItemsToCandidatesResult {
  const candidates: LlmProposalCandidate[] = [];
  let droppedItemCount = 0;

  for (const item of items) {
    const parsed = llmProposalItemSchema.safeParse(item);
    if (!parsed.success) {
      droppedItemCount += 1;
      continue;
    }

    const { proposalType, sourceNodeAlias, targetNodeAlias, relationTypeAlias, rationale } = parsed.data;
    const sourceNodeId = aliasMaps.nodeAliasToId.get(sourceNodeAlias);
    const targetNodeId = aliasMaps.nodeAliasToId.get(targetNodeAlias);
    const relationTypeId = aliasMaps.relationAliasToId.get(relationTypeAlias);

    if (!sourceNodeId || !targetNodeId || !relationTypeId) {
      droppedItemCount += 1;
      continue;
    }

    candidates.push({
      proposalType,
      sourceNodeId,
      targetNodeId,
      relationTypeId,
      rationale,
    });
  }

  return { candidates, droppedItemCount };
}
