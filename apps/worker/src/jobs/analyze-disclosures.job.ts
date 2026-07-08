/**
 * LLM 공시 분석 잡 (docs/usecases/030/plan.md 모듈 14).
 * 오케스트레이터: 컨텍스트 로드 → 선별/상한 → 원문 fetch → LLM 호출 → 필터 → 적재 → 마킹 → 기록.
 * 전 의존성 주입형 — 테스트는 전부 mock으로 검증. 잡은 chain_snapshots 및 하위 테이블에 쓰지 않는다(BR-6).
 */
import {
  ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT,
  BATCH_JOB_TYPE_ANALYZE_DISCLOSURES,
  BATCH_STALE_RUNNING_HOURS,
  LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD,
  buildProposalDedupeKey,
  filterProposalCandidates,
  type ActiveRelationType,
  type BatchRunStatus,
  type ChainAnalysisContext,
} from "@iib/domain";
import { LlmConfigError, LlmRequestError, type LlmAnalysisInput, type LlmPort } from "../adapters/llm/contract";
import type { BatchLogger } from "../runtime/batch-log";
import type { FinishRunInput, ItemFailureInput } from "../repositories/batch.repository";
import type { ActiveOfficialChain, SnapshotComposition } from "../repositories/chains.repository";
import type { ActiveRelationTypeRow } from "../repositories/relation-types.repository";
import type { UnanalyzedDisclosure } from "../repositories/disclosures.repository";
import type { PendingProposalKey } from "../repositories/llm-proposals.repository";
import type { RepoResult } from "../repositories/result";

const DISCLOSURE_SOURCE_DART = "dart";
const DISCLOSURE_SOURCE_SEC = "sec";
const DEFAULT_UNANALYZED_CHUNK_SIZE = 1_000;

export interface OpenDartDocumentPort {
  fetchDisclosureDocumentText(rceptNo: string): Promise<string | null>;
}

export interface SecEdgarDocumentPort {
  fetchFilingDocumentText(url: string): Promise<string | null>;
}

export interface AnalyzeDisclosuresRepos {
  listActiveOfficialChains(): Promise<RepoResult<ActiveOfficialChain[]>>;
  findLatestSnapshotComposition(chainId: string): Promise<RepoResult<SnapshotComposition | null>>;
  listActiveRelationTypes(): Promise<RepoResult<ActiveRelationTypeRow[]>>;
  listUnanalyzedChunk(params: { limit: number; offset: number }): Promise<RepoResult<UnanalyzedDisclosure[]>>;
  markAnalyzed(disclosureIds: string[], analyzedAtIso: string): Promise<RepoResult<void>>;
  listPendingKeys(chainIds: string[]): Promise<RepoResult<PendingProposalKey[]>>;
  insertPendingProposal(row: {
    chainId: string;
    basedOnSnapshotId: string;
    proposalType: "relation_add" | "relation_update" | "relation_delete";
    sourceNodeId: string;
    targetNodeId: string;
    relationTypeId: string;
    disclosureId: string;
    rationale: string;
  }): Promise<{ ok: true; inserted: boolean } | { ok: false; error: string }>;
}

export interface AnalyzeDisclosuresJobDeps {
  /** 생성을 잡 실행 시점으로 지연 — LlmConfigError를 잡 수준 실패로 기록 가능하게 함(E14). */
  llmFactory: () => LlmPort;
  openDart: OpenDartDocumentPort;
  secEdgar: SecEdgarDocumentPort;
  repos: AnalyzeDisclosuresRepos;
  batchLog: BatchLogger;
  /** 미분석 공시 청크 스캔 크기(리포지토리 range 상한과 무관 — 잡 내부 페이지네이션 단위). */
  unanalyzedChunkSize?: number;
}

export interface AnalyzeDisclosuresJob {
  run(now?: Date): Promise<BatchRunStatus>;
}

interface WorkItem {
  disclosure: UnanalyzedDisclosure;
  chainIds: string[];
}

export function createAnalyzeDisclosuresJob(deps: AnalyzeDisclosuresJobDeps): AnalyzeDisclosuresJob {
  const { llmFactory, openDart, secEdgar, repos, batchLog } = deps;
  const unanalyzedChunkSize = deps.unanalyzedChunkSize ?? DEFAULT_UNANALYZED_CHUNK_SIZE;

  return {
    async run(now: Date = new Date()): Promise<BatchRunStatus> {
      // E13 2차 방어(DB 레벨) — 인메모리 락은 scheduler가 1차 수행(R-6).
      const running = await batchLog.isRunning(BATCH_JOB_TYPE_ANALYZE_DISCLOSURES, BATCH_STALE_RUNNING_HOURS);
      if (running) {
        console.warn("[analyze-disclosures] already running — skip this tick");
        return "success";
      }

      const runId = await batchLog.start(BATCH_JOB_TYPE_ANALYZE_DISCLOSURES);
      if (runId === null) {
        console.error("[analyze-disclosures] failed to start a batch_runs record — proceeding without runId tracking");
      }

      try {
        return await runInternal(runId, now);
      } catch (error) {
        console.error("[analyze-disclosures] unexpected exception:", error);
        if (runId !== null) {
          await batchLog.finish(runId, {
            status: "failed",
            processedCount: 0,
            failedCount: 0,
            isCarriedOver: false,
            errorLog: `예상 밖 예외: ${(error as Error).message ?? String(error)}`,
          });
        }
        return "failed";
      }
    },
  };

  async function runInternal(runId: string | null, now: Date): Promise<BatchRunStatus> {
    // 2) LLM 준비 검증 — 자격 정보 누락/무효는 잡 수준 실패로 즉시 종료(E14).
    let llm: LlmPort;
    try {
      llm = llmFactory();
    } catch (error) {
      const message =
        error instanceof LlmConfigError ? error.message : `LLM 클라이언트 생성 실패: ${(error as Error).message}`;
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: `LLM 자격 정보 누락/무효 — 설정 점검: ${message}`,
      });
      return "failed";
    }

    // 3) 컨텍스트 로드 — 활성 공식 체인(BR-1·E6).
    const chainsResult = await repos.listActiveOfficialChains();
    if (!chainsResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: `공식 체인 로드 실패: ${chainsResult.error}`,
      });
      return "failed";
    }
    const chains = chainsResult.data;

    if (chains.length === 0) {
      // E9·R-11: 공식 체인이 아예 없으면 마킹 없이 success(시드 전 대량 마킹 방지).
      await finish(runId, { status: "success", processedCount: 0, failedCount: 0, isCarriedOver: false, errorLog: null });
      return "success";
    }

    const chainNameById = new Map(chains.map((c) => [c.id, c.name]));
    const compositionByChainId = new Map<string, SnapshotComposition>();
    for (const chain of chains) {
      const compositionResult = await repos.findLatestSnapshotComposition(chain.id);
      if (!compositionResult.ok) {
        await finish(runId, {
          status: "failed",
          processedCount: 0,
          failedCount: 0,
          isCarriedOver: false,
          errorLog: `체인(${chain.id}) 최신 스냅샷 로드 실패: ${compositionResult.error}`,
        });
        return "failed";
      }
      if (compositionResult.data !== null) {
        compositionByChainId.set(chain.id, compositionResult.data);
      }
      // 스냅샷이 없는 체인(E9 유사)은 조용히 제외 — 시드 직후 등 정상 상태.
    }

    const relationTypesResult = await repos.listActiveRelationTypes();
    if (!relationTypesResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: `활성 관계 종류 로드 실패: ${relationTypesResult.error}`,
      });
      return "failed";
    }
    const activeRelationTypes: ActiveRelationType[] = relationTypesResult.data;
    const relationTypeById = new Map(activeRelationTypes.map((t) => [t.relationTypeId, t]));

    const chainIds = [...compositionByChainId.keys()];
    const pendingKeysResult = await repos.listPendingKeys(chainIds);
    if (!pendingKeysResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: `기존 pending 제안 키 로드 실패: ${pendingKeysResult.error}`,
      });
      return "failed";
    }

    const seenDedupeKeys = new Set<string>();
    for (const key of pendingKeysResult.data) {
      if (key.relationTypeId === null) continue; // F-1 — non-null 제안만 적재하므로 과거 null 키는 대조 불필요
      const relationType = relationTypeById.get(key.relationTypeId);
      const isDirected = relationType?.isDirected ?? true;
      seenDedupeKeys.add(
        buildProposalDedupeKey(key.chainId, key.sourceNodeId, key.targetNodeId, key.relationTypeId, key.proposalType, isDirected),
      );
    }

    // securityId -> 관련 chainId[] 매칭 인덱스(상장기업 노드 기준, spec 4-4).
    const chainIdsBySecurityId = new Map<string, string[]>();
    for (const [chainId, composition] of compositionByChainId) {
      for (const node of composition.nodes) {
        if (node.nodeKind !== "listed_company" || node.securityId === null) continue;
        const list = chainIdsBySecurityId.get(node.securityId) ?? [];
        list.push(chainId);
        chainIdsBySecurityId.set(node.securityId, list);
      }
    }

    // 4) 미분석 공시 스캔 — 공시일 오름차순 청크 반복.
    const allUnanalyzed: UnanalyzedDisclosure[] = [];
    let offset = 0;
    for (;;) {
      const chunkResult = await repos.listUnanalyzedChunk({ limit: unanalyzedChunkSize, offset });
      if (!chunkResult.ok) {
        await finish(runId, {
          status: "failed",
          processedCount: 0,
          failedCount: 0,
          isCarriedOver: false,
          errorLog: `미분석 공시 조회 실패: ${chunkResult.error}`,
        });
        return "failed";
      }
      allUnanalyzed.push(...chunkResult.data);
      if (chunkResult.data.length < unanalyzedChunkSize) break;
      offset += unanalyzedChunkSize;
    }

    if (allUnanalyzed.length === 0) {
      await finish(runId, { status: "success", processedCount: 0, failedCount: 0, isCarriedOver: false, errorLog: null });
      return "success"; // E8
    }

    const workItems: WorkItem[] = [];
    const irrelevantIds: string[] = [];
    for (const disclosure of allUnanalyzed) {
      const relatedChainIds = chainIdsBySecurityId.get(disclosure.securityId) ?? [];
      if (relatedChainIds.length === 0) {
        irrelevantIds.push(disclosure.id); // BR-12: 공식 체인 무관 — LLM 호출 없이 마킹 대상
      } else {
        workItems.push({ disclosure, chainIds: relatedChainIds });
      }
    }

    // 5) 일일 분석 건수 상한 적용(R-4) — 공시 단위 원자적 포함/이월 판정, 첫 초과 지점 이후 전부 이월.
    let budget = ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT;
    const includedItems: WorkItem[] = [];
    let isCarriedOver = false;
    for (const item of workItems) {
      if (item.chainIds.length <= budget) {
        includedItems.push(item);
        budget -= item.chainIds.length;
      } else {
        isCarriedOver = true;
        break;
      }
    }

    // 6) 무관 공시 마킹(상한과 무관하게 이번 회차 전량, LLM 호출 없음 — 비용 0).
    const nowIso = now.toISOString();
    if (irrelevantIds.length > 0) {
      const markResult = await repos.markAnalyzed(irrelevantIds, nowIso);
      if (!markResult.ok) {
        console.error(`[analyze-disclosures] markAnalyzed(irrelevant) failed: ${markResult.error}`);
      }
    }

    // 7) 공시 처리 루프(공시 단위 격리, BR-10).
    let analyzedCount = irrelevantIds.length;
    let failedCount = 0;
    let insertedCount = 0;
    let skippedDuplicateCount = 0;
    const droppedByReason = new Map<string, number>();
    const itemFailures: ItemFailureInput[] = [];
    let consecutiveFailures = 0;
    let configErrorAborted = false;
    let anyLlmCallAttempted = false;
    let anySuccess = false;

    itemLoop: for (const item of includedItems) {
      const contentExcerpt = await fetchContentExcerpt(item.disclosure);
      let itemFailed = false;
      let lastError = "";

      for (const chainId of item.chainIds) {
        const composition = compositionByChainId.get(chainId);
        if (!composition) continue; // 방어적 — 로드 이후 삭제된 경우

        const input: LlmAnalysisInput = {
          disclosure: {
            title: item.disclosure.title,
            disclosureDate: item.disclosure.disclosureDate,
            companyName: item.disclosure.securityName,
            ticker: item.disclosure.securityTicker,
            market: item.disclosure.securityMarket,
            url: item.disclosure.url,
            contentExcerpt,
          },
          chainContext: {
            chainName: chainNameById.get(chainId) ?? chainId,
            nodes: composition.nodes.map((n) => ({ nodeId: n.nodeId, displayName: n.displayName, nodeKind: n.nodeKind })),
            edges: composition.edges.map((e) => ({
              sourceNodeId: e.sourceNodeId,
              targetNodeId: e.targetNodeId,
              relationTypeName: relationTypeById.get(e.relationTypeId)?.name ?? e.relationTypeId,
            })),
            activeRelationTypes: activeRelationTypes.map((t) => ({
              relationTypeId: t.relationTypeId,
              name: t.name,
              isDirected: t.isDirected,
            })),
          },
        };

        anyLlmCallAttempted = true;
        let outcome;
        try {
          outcome = await llm.analyzeDisclosure(input);
        } catch (error) {
          if (error instanceof LlmConfigError) {
            configErrorAborted = true;
            lastError = error.message;
            itemFailed = true;
            break;
          }
          if (error instanceof LlmRequestError) {
            consecutiveFailures += 1;
            lastError = error.message;
            itemFailed = true;
            break; // 이 공시의 잔여 체인 중단(spec 4-8) — 공시 단위 실패
          }
          consecutiveFailures += 1;
          lastError = (error as Error).message ?? String(error);
          itemFailed = true;
          break;
        }

        consecutiveFailures = 0;
        anySuccess = true;

        const ctx: ChainAnalysisContext = {
          chainId,
          latestSnapshotId: composition.snapshotId,
          nodes: composition.nodes.map((n) => ({ nodeId: n.nodeId, displayName: n.displayName, nodeKind: n.nodeKind })),
          edges: composition.edges.map((e) => ({
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            relationTypeId: e.relationTypeId,
          })),
        };

        const filterResult = filterProposalCandidates(outcome.proposals, ctx, activeRelationTypes, seenDedupeKeys);
        for (const dropped of filterResult.dropped) {
          droppedByReason.set(dropped.reason, (droppedByReason.get(dropped.reason) ?? 0) + 1);
        }

        for (const accepted of filterResult.accepted) {
          seenDedupeKeys.add(accepted.dedupeKey);
          const insertResult = await repos.insertPendingProposal({
            chainId,
            basedOnSnapshotId: composition.snapshotId,
            proposalType: accepted.proposalType,
            sourceNodeId: accepted.sourceNodeId,
            targetNodeId: accepted.targetNodeId,
            relationTypeId: accepted.relationTypeId,
            disclosureId: item.disclosure.id,
            rationale: accepted.rationale,
          });
          if (!insertResult.ok) {
            itemFailed = true;
            lastError = insertResult.error;
            continue;
          }
          if (insertResult.inserted) {
            insertedCount += 1;
          } else {
            skippedDuplicateCount += 1; // 23505 — 병합(E5)
          }
        }
      }

      if (itemFailed) {
        failedCount += 1;
        itemFailures.push({ securityId: item.disclosure.securityId, attemptCount: 1, lastError });
      } else {
        const markResult = await repos.markAnalyzed([item.disclosure.id], nowIso);
        if (markResult.ok) {
          analyzedCount += 1;
        } else {
          // E16: 마킹 실패 — 실패 카운트에 포함(제안은 이미 적재됨, 다음 회차 재분석 시 멱등 차단)
          failedCount += 1;
          itemFailures.push({
            securityId: item.disclosure.securityId,
            attemptCount: 1,
            lastError: `분석 완료 마킹 실패: ${markResult.error}`,
          });
        }
      }

      if (configErrorAborted || consecutiveFailures >= LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD) {
        isCarriedOver = true; // 잔여 공시는 미분석 유지 — 다음 실행 이월
        break itemLoop;
      }
    }

    // 8) 실패 기록.
    if (runId !== null && itemFailures.length > 0) {
      await batchLog.itemFailures(runId, itemFailures);
    }

    // 9) 종료 판정(R-8).
    let status: BatchRunStatus;
    if (configErrorAborted && !anySuccess) {
      status = "failed"; // E14 — 인증 오류로 중단 + 성공 0
    } else if (anyLlmCallAttempted && !anySuccess) {
      status = "failed"; // E15 — 전 호출 실패
    } else if (failedCount > 0 || isCarriedOver) {
      status = "partial_success";
    } else {
      status = "success";
    }

    const errorLogParts: string[] = [];
    errorLogParts.push(`분석 완료 ${analyzedCount}건(무관 마킹 포함), 실패 ${failedCount}건`);
    errorLogParts.push(`제안 적재 ${insertedCount}건, 중복 스킵 ${skippedDuplicateCount}건`);
    if (droppedByReason.size > 0) {
      const summary = [...droppedByReason.entries()].map(([reason, count]) => `${reason}=${count}`).join(", ");
      errorLogParts.push(`필터 드롭: ${summary}`);
    }
    if (isCarriedOver) {
      errorLogParts.push("일일 상한/조기중단으로 인한 이월 발생");
    }
    if (configErrorAborted) {
      errorLogParts.push("LLM 인증 오류로 조기 중단");
    }

    await finish(runId, {
      status,
      processedCount: analyzedCount,
      failedCount,
      isCarriedOver,
      errorLog: errorLogParts.join("; "),
    });

    return status;
  }

  async function fetchContentExcerpt(disclosure: UnanalyzedDisclosure): Promise<string | null> {
    if (disclosure.source === DISCLOSURE_SOURCE_DART) {
      return openDart.fetchDisclosureDocumentText(disclosure.externalId);
    }
    if (disclosure.source === DISCLOSURE_SOURCE_SEC) {
      if (!disclosure.url) return null;
      return secEdgar.fetchFilingDocumentText(disclosure.url);
    }
    return null; // toss 등 원문 조회 미지원 소스는 메타데이터-온리
  }

  async function finish(runId: string | null, summary: FinishRunInput): Promise<void> {
    if (runId === null) {
      console.error("[analyze-disclosures] no runId — skipping finish() record", summary);
      return;
    }
    await batchLog.finish(runId, summary);
  }
}
