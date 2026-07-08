import { DATA_SOURCE_LABELS, FRESHNESS_JOBS } from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { valuechainsErrorCodes, type ValuechainsServiceError } from "@/features/valuechains/backend/error";
import { RepositoryError, type ValuechainsViewRepository } from "@/features/valuechains/backend/repository";
import {
  BatchRunFreshnessRowSchema,
  ChainSnapshotRowSchema,
  ChainViewResponseSchema,
  SnapshotEdgeRowSchema,
  SnapshotGroupRowSchema,
  SnapshotNodeRowSchema,
  ValueChainRowSchema,
  type ChainViewResponse,
  type ValueChainRow,
} from "@/features/valuechains/backend/schema";

/**
 * 순수 접근 제어 함수 (BR-1 + 결정 C-2).
 * 비로그인·비소유자 모두 `{allowed:false}`로 통일한다 — 401/403 분기 없음(체인 존재 자체 비노출).
 */
export const checkChainAccess = (
  chain: Pick<ValueChainRow, "chain_type" | "owner_id" | "is_archived">,
  currentUserId: string | null,
): { allowed: true; isOwner: boolean } | { allowed: false } => {
  if (chain.is_archived) {
    return { allowed: false };
  }
  if (chain.chain_type === "official") {
    return { allowed: true, isOwner: false };
  }
  // chain_type === 'user'
  if (currentUserId !== null && currentUserId === chain.owner_id) {
    return { allowed: true, isOwner: true };
  }
  return { allowed: false };
};

const buildStructureLoadFailure = (
  message: string,
  details?: unknown,
): HandlerResult<ChainViewResponse, ValuechainsServiceError, unknown> =>
  failure(500, valuechainsErrorCodes.structureLoadFailed, message, details);

/**
 * 밸류체인 뷰(최신 스냅샷 구조) 조회 — spec Main Scenario 3~8, plan 모듈 B4.
 * repository 인터페이스에만 의존한다(Supabase 쿼리 문법을 알지 못함).
 */
export const getChainView = async (
  repo: ValuechainsViewRepository,
  chainId: string,
  currentUserId: string | null,
): Promise<HandlerResult<ChainViewResponse, ValuechainsServiceError, unknown>> => {
  try {
    // 1. 체인 헤더 조회
    const chainRow = await repo.findChainById(chainId);
    if (!chainRow) {
      return failure(404, valuechainsErrorCodes.chainNotFound, "체인을 찾을 수 없습니다.");
    }

    const chainParsed = ValueChainRowSchema.safeParse(chainRow);
    if (!chainParsed.success) {
      return buildStructureLoadFailure(
        "체인 데이터 형식이 올바르지 않습니다.",
        chainParsed.error.format(),
      );
    }
    const chain = chainParsed.data;

    // 2. 접근 제어 (BR-1 + C-2 — 미존재와 동일 메시지로 존재 비노출)
    const access = checkChainAccess(chain, currentUserId);
    if (!access.allowed) {
      return failure(404, valuechainsErrorCodes.chainNotFound, "체인을 찾을 수 없습니다.");
    }

    // 3. 최신 스냅샷
    const snapshotRow = await repo.findLatestSnapshot(chainId);
    if (!snapshotRow) {
      return failure(
        500,
        valuechainsErrorCodes.snapshotMissing,
        "체인 구성 스냅샷을 찾을 수 없습니다.",
      );
    }
    const snapshotParsed = ChainSnapshotRowSchema.safeParse(snapshotRow);
    if (!snapshotParsed.success) {
      return buildStructureLoadFailure(
        "스냅샷 데이터 형식이 올바르지 않습니다.",
        snapshotParsed.error.format(),
      );
    }
    const snapshot = snapshotParsed.data;

    // 4. 구조(그룹/노드/엣지) + 수집 시각 병렬 조회
    const [groupRows, nodeRows, edgeRows, quotesAt, financialsAt, fxAt] = await Promise.all([
      repo.findSnapshotGroups(snapshot.id),
      repo.findSnapshotNodes(snapshot.id),
      repo.findSnapshotEdges(snapshot.id),
      repo.findLatestBatchSuccessAt(FRESHNESS_JOBS.quotes),
      repo.findLatestBatchSuccessAt(FRESHNESS_JOBS.financials),
      repo.findLatestBatchSuccessAt(FRESHNESS_JOBS.fxAndMarketHours),
    ]);

    const groupsParsed = SnapshotGroupRowSchema.array().safeParse(groupRows);
    if (!groupsParsed.success) {
      return buildStructureLoadFailure("그룹 데이터 형식이 올바르지 않습니다.", groupsParsed.error.format());
    }
    const nodesParsed = SnapshotNodeRowSchema.array().safeParse(nodeRows);
    if (!nodesParsed.success) {
      return buildStructureLoadFailure("노드 데이터 형식이 올바르지 않습니다.", nodesParsed.error.format());
    }
    const edgesParsed = SnapshotEdgeRowSchema.array().safeParse(edgeRows);
    if (!edgesParsed.success) {
      return buildStructureLoadFailure("엣지 데이터 형식이 올바르지 않습니다.", edgesParsed.error.format());
    }
    const freshnessRowsParsed = BatchRunFreshnessRowSchema.array().safeParse(
      [quotesAt, financialsAt, fxAt].map((finishedAt) => ({ finished_at: finishedAt })),
    );
    if (!freshnessRowsParsed.success) {
      return buildStructureLoadFailure(
        "수집 시각 데이터 형식이 올바르지 않습니다.",
        freshnessRowsParsed.error.format(),
      );
    }

    // 5. DTO 변환 (snake_case → camelCase)
    const dto: ChainViewResponse = {
      chain: {
        id: chain.id,
        name: chain.name,
        chainType: chain.chain_type,
        focusType: chain.focus_type,
        focusSecurity:
          chain.focus_type === "company" && chain.focus_security
            ? {
                id: chain.focus_security.id,
                ticker: chain.focus_security.ticker,
                name: chain.focus_security.name,
                market: chain.focus_security.market,
              }
            : null,
        isOwner: access.isOwner,
      },
      snapshot: {
        id: snapshot.id,
        effectiveAt: snapshot.effective_at,
        changeSource: snapshot.change_source,
      },
      groups: groupsParsed.data.map((group) => ({ id: group.id, name: group.name })),
      nodes: nodesParsed.data.map((node) => ({
        id: node.id,
        groupId: node.group_id,
        nodeKind: node.node_kind,
        security: node.security
          ? {
              id: node.security.id,
              ticker: node.security.ticker,
              name: node.security.name,
              market: node.security.market,
              listingStatus: node.security.listing_status,
            }
          : null,
        subjectName: node.subject_name,
        subjectType: node.subject_type,
        subjectMemo: node.subject_memo,
        position:
          node.position_x !== null && node.position_y !== null
            ? { x: node.position_x, y: node.position_y }
            : null,
      })),
      edges: edgesParsed.data.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source_node_id,
        targetNodeId: edge.target_node_id,
        relationType: {
          id: edge.relation_type.id,
          name: edge.relation_type.name,
          isDirected: edge.relation_type.is_directed,
          isActive: edge.relation_type.is_active,
        },
      })),
      dataFreshness: {
        sources: [...DATA_SOURCE_LABELS],
        lastCollectedAt: {
          quotes: quotesAt,
          financials: financialsAt,
          fxAndMarketHours: fxAt,
        },
      },
    };

    // 6. 응답 스키마 최종 검증
    const responseParsed = ChainViewResponseSchema.safeParse(dto);
    if (!responseParsed.success) {
      return buildStructureLoadFailure(
        "응답 데이터 형식이 올바르지 않습니다.",
        responseParsed.error.format(),
      );
    }

    return success(responseParsed.data);
  } catch (err) {
    if (err instanceof RepositoryError) {
      return buildStructureLoadFailure(err.message);
    }
    return buildStructureLoadFailure(
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
    );
  }
};
