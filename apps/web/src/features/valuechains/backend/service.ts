import {
  DATA_SOURCE_LABELS,
  FRESHNESS_JOBS,
  MAX_CHAINS_PER_USER,
  MAX_NODES_PER_CHAIN,
  dateToCalendarQuarter,
  resolveCloneName,
  resolveDailyMetricsRange,
  resolveQuarterlyMetricsRange,
  toSeoulDayEndIso,
  todayInSeoul,
  TIMESERIES_MIN_START_DATE,
  pruneEmptyGroups,
  validateChainStructure,
  validateEdgesPayload,
  type EdgeSaveViolation,
  type NodeIdentity,
  type PreviousEdgeIdentity,
  type SaveChainNodePayload,
  type SaveChainRequest,
  type SaveChainResult,
  type SaveEdgePayload,
  type StructureViolation,
  type IsoDate,
} from "@iib/domain";
import { buildPagination } from "@/backend/http/pagination";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import {
  valuechainListErrorCodes,
  valuechainsErrorCodes,
  type ValuechainListServiceError,
  type ValuechainsServiceError,
} from "@/features/valuechains/backend/error";
import {
  RepositoryError,
  CloneRpcError,
  SaveRpcError,
  findNodeDetailRow as findNodeDetailRowRepo,
  findSnapshotMarkers,
  findSnapshotStructureAt,
  findDailyMetricAt,
  findQuarterlyMetric as findQuarterlyMetricRepo,
  type ValuechainsViewRepository,
  type ChainMetricsRepository,
  type ValuechainsCloneRepository,
  type ValuechainsDeleteRepository,
  type ValuechainsSaveRepository,
  type OfficialSaveRepository,
} from "@/features/valuechains/backend/repository";
import {
  BatchRunFreshnessRowSchema,
  ChainCardListResponseSchema,
  ChainCardRpcRowSchema,
  ChainSnapshotRowSchema,
  ChainViewResponseSchema,
  CloneChainResponseSchema,
  CloneLatestSnapshotRowSchema,
  CloneRpcResultSchema,
  CloneSourceChainRowSchema,
  DailyAnnotationsRowSchema,
  DailyMetricRowSchema,
  DailyMetricsResponseSchema,
  DeleteTargetChainRowSchema,
  LatestSnapshotResponseSchema,
  NodeDetailRowSchema,
  NodeDetailResponseSchema,
  QuarterlyMetricRowSchema,
  QuarterlyMetricsResponseSchema,
  SaveChainResponseSchema,
  SaveRpcResultSchema,
  SnapshotAtResponseSchema,
  SnapshotAtRpcRowSchema,
  SnapshotEdgeRowSchema,
  SnapshotGroupRowSchema,
  SnapshotMarkerRowSchema,
  SnapshotNodeRowSchema,
  TimelineMetaResponseSchema,
  ValueChainRowSchema,
  type ChainCardListQuery,
  type ChainCardListResponse,
  type ChainViewResponse,
  type CloneChainResponse,
  type DailyMetricsQuery,
  type DailyMetricsResponse,
  type LatestSnapshotResponse,
  type NodeDetailResponse,
  type QuarterlyMetricsQuery,
  type QuarterlyMetricsResponse,
  type SaveChainResponse,
  type SaveOfficialChainRequestBody,
  type SnapshotAtResponse,
  type TimelineMetaResponse,
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

// ============================================
// 체인 카드 목록 (UC-007, plan 모듈 C-4)
// ============================================

/** service가 의존하는 최소 인터페이스 — Supabase 쿼리 문법을 알지 못한다(테스트 시 mock 용이). */
export type ChainCardsRepository = {
  findChainCards: (params: {
    chainType: "official" | "user";
    ownerId: string | null;
    limit: number;
    offset: number;
  }) => Promise<{ rows: unknown[]; error: string | null }>;
};

const buildListFailure = (
  status: number,
  code: ValuechainListServiceError,
  message: string,
  details?: unknown,
): HandlerResult<ChainCardListResponse, ValuechainListServiceError, unknown> =>
  failure(status, code, message, details);

/**
 * official/user 공용 카드 목록 조회 — repository 인터페이스에만 의존한다(DRY, plan C-4).
 * 처리 순서: offset 계산 → repository 호출 → 오류 시 500 → Row 검증 → DTO 변환
 * (latestMetric null 규칙: metric_date 또는 total_market_cap_krw가 null이면 latestMetric=null,
 * 엣지 3 — 집계 미존재/시세 장애를 0과 구분) → 최종 응답 스키마 검증 → success().
 */
const listChainCards = async (
  repo: ChainCardsRepository,
  params: { chainType: "official" | "user"; ownerId: string | null },
  query: ChainCardListQuery,
): Promise<HandlerResult<ChainCardListResponse, ValuechainListServiceError, unknown>> => {
  const offset = (query.page - 1) * query.limit;

  const { rows, error } = await repo.findChainCards({
    chainType: params.chainType,
    ownerId: params.ownerId,
    limit: query.limit,
    offset,
  });

  if (error) {
    return buildListFailure(500, valuechainListErrorCodes.fetchFailed, error);
  }

  const items: ChainCardListResponse["items"] = [];
  let totalCount = 0;

  for (const rawRow of rows) {
    const parsedRow = ChainCardRpcRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return buildListFailure(
        500,
        valuechainListErrorCodes.validationError,
        "체인 카드 목록 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }

    const row = parsedRow.data;
    totalCount = row.total_count;

    const hasMetric = row.metric_date !== null && row.total_market_cap_krw !== null;

    items.push({
      id: row.id,
      name: row.name,
      chainType: row.chain_type,
      focusType: row.focus_type,
      focusCompanyName: row.focus_company_name,
      nodeCount: row.node_count,
      latestMetric: hasMetric
        ? {
            metricDate: row.metric_date as string,
            totalMarketCapKrw: row.total_market_cap_krw as string,
            coveredNodeCount: row.covered_node_count ?? 0,
            totalNodeCount: row.total_node_count ?? 0,
            isCarriedForward: row.is_carried_forward ?? false,
          }
        : null,
      updatedAt: row.updated_at,
    });
  }

  const parsedResponse = ChainCardListResponseSchema.safeParse({
    items,
    pagination: buildPagination(query.page, query.limit, totalCount),
  });

  if (!parsedResponse.success) {
    return buildListFailure(
      500,
      valuechainListErrorCodes.validationError,
      "체인 카드 목록 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};

/** 공식 밸류체인 목록(spec `GET /valuechains/official`) — 조회 전용, 인증 불필요. */
export const listOfficialChainCards = (
  repo: ChainCardsRepository,
  query: ChainCardListQuery,
): Promise<HandlerResult<ChainCardListResponse, ValuechainListServiceError, unknown>> =>
  listChainCards(repo, { chainType: "official", ownerId: null }, query);

/** 내 밸류체인 목록(spec `GET /valuechains/mine`) — 세션 검증은 route 책임. */
export const listMyChainCards = (
  repo: ChainCardsRepository,
  userId: string,
  query: ChainCardListQuery,
): Promise<HandlerResult<ChainCardListResponse, ValuechainListServiceError, unknown>> =>
  listChainCards(repo, { chainType: "user", ownerId: userId }, query);

// ============================================================================
// UC-010: 밸류체인 대시보드 패널(일별/분기 지표) 조회
// ============================================================================

/** 체인 접근 검증 전용 최소 인터페이스(UC-010~012 공유) — 헤더 조회만 필요. */
export type ChainHeaderRepository = {
  findChainById(chainId: string): Promise<unknown | null>;
};

/**
 * 체인 헤더 조회 + 접근 검증(C-2 404 통일) 공용 절차 — UC-010~012 서비스가 모두 재사용한다.
 * `checkChainAccess`(모듈 상단, UC-009 정의)를 그대로 재사용해 단일 판정 지점을 유지한다(DRY).
 */
const verifyChainReadAccess = async (
  repo: ChainHeaderRepository,
  chainId: string,
  currentUserId: string | null,
): Promise<{ ok: true; isOwner: boolean } | { ok: false; status: 404 | 500; message: string; details?: unknown }> => {
  const chainRow = await repo.findChainById(chainId);
  if (!chainRow) {
    return { ok: false, status: 404, message: "체인을 찾을 수 없습니다." };
  }
  const parsed = ValueChainRowSchema.safeParse(chainRow);
  if (!parsed.success) {
    return {
      ok: false,
      status: 500,
      message: "체인 데이터 형식이 올바르지 않습니다.",
      details: parsed.error.format(),
    };
  }
  const access = checkChainAccess(parsed.data, currentUserId);
  if (!access.allowed) {
    return { ok: false, status: 404, message: "체인을 찾을 수 없습니다." };
  }
  return { ok: true, isOwner: access.isOwner };
};

const buildMetricsFailure = <T>(
  status: number,
  code: ValuechainsServiceError,
  message: string,
  details?: unknown,
): HandlerResult<T, ValuechainsServiceError, unknown> => failure(status, code, message, details);

/** 일별 지표(가치총액) 조회 — spec §6.3(1), plan 모듈 12. */
export const getDailyMetrics = async (
  deps: { accessRepo: ChainHeaderRepository; metricsRepo: ChainMetricsRepository },
  input: { chainId: string; currentUserId: string | null; query: DailyMetricsQuery; today: IsoDate },
): Promise<HandlerResult<DailyMetricsResponse, ValuechainsServiceError, unknown>> => {
  const { chainId, currentUserId, query, today } = input;

  const access = await verifyChainReadAccess(deps.accessRepo, chainId, currentUserId);
  if (!access.ok) {
    return buildMetricsFailure(
      access.status,
      access.status === 404 ? valuechainsErrorCodes.chainNotFound : valuechainsErrorCodes.structureLoadFailed,
      access.message,
      access.details,
    );
  }

  const range = resolveDailyMetricsRange({ from: query.from, to: query.to, at: query.at, today });
  if (!range.ok) {
    return buildMetricsFailure(400, valuechainsErrorCodes.invalidRequest, "요청 파라미터가 올바르지 않습니다.");
  }

  const seriesResult = await deps.metricsRepo.findDailySeries(chainId, range.from, range.to);
  if (!seriesResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.metricsFetchError, seriesResult.message);
  }
  const seriesParsed = DailyMetricRowSchema.array().safeParse(seriesResult.data);
  if (!seriesParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "일별 지표 데이터 형식이 올바르지 않습니다.",
      seriesParsed.error.format(),
    );
  }

  const currentResult = range.at
    ? await deps.metricsRepo.findDailyByDate(chainId, range.at)
    : await deps.metricsRepo.findLatestDaily(chainId);
  if (!currentResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.metricsFetchError, currentResult.message);
  }
  const currentParsed = currentResult.data
    ? DailyMetricRowSchema.safeParse(currentResult.data)
    : null;
  if (currentParsed && !currentParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "일별 현재값 데이터 형식이 올바르지 않습니다.",
      currentParsed.error.format(),
    );
  }

  const asOfIso = range.at ? toSeoulDayEndIso(range.at) : new Date().toISOString();
  const metricDateForAnnotations = currentParsed?.success ? currentParsed.data.metric_date : null;
  const annotationsResult = await deps.metricsRepo.fetchDailyAnnotations(
    chainId,
    asOfIso,
    metricDateForAnnotations,
  );
  if (!annotationsResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.metricsFetchError, annotationsResult.message);
  }
  const annotationsParsed = DailyAnnotationsRowSchema.safeParse(annotationsResult.data);
  if (!annotationsParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "지표 주석 데이터 형식이 올바르지 않습니다.",
      annotationsParsed.error.format(),
    );
  }

  const dto: DailyMetricsResponse = {
    chainId,
    current: currentParsed?.success
      ? {
          metricDate: currentParsed.data.metric_date,
          totalMarketCapKrw: currentParsed.data.total_market_cap_krw,
          coveredNodeCount: currentParsed.data.covered_node_count,
          totalNodeCount: currentParsed.data.total_node_count,
          isCarriedForward: currentParsed.data.is_carried_forward,
          basedOnSnapshotId: currentParsed.data.based_on_snapshot_id,
        }
      : null,
    series: seriesParsed.data.map((row) => ({
      metricDate: row.metric_date,
      totalMarketCapKrw: row.total_market_cap_krw,
      coveredNodeCount: row.covered_node_count,
      totalNodeCount: row.total_node_count,
      isCarriedForward: row.is_carried_forward,
    })),
    annotations: {
      baseCurrency: "KRW",
      fxBasis: "daily",
      sharesAsOfDateMin: annotationsParsed.data.shares_as_of_min,
      sharesAsOfDateMax: annotationsParsed.data.shares_as_of_max,
      isClosingConfirmed: annotationsParsed.data.all_closing_confirmed,
    },
  };

  const responseParsed = DailyMetricsResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "일별 지표 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data);
};

/** 분기 지표(매출 합계) 조회 — spec §6.3(2), plan 모듈 12. */
export const getQuarterlyMetrics = async (
  deps: { accessRepo: ChainHeaderRepository; metricsRepo: ChainMetricsRepository },
  input: {
    chainId: string;
    currentUserId: string | null;
    query: QuarterlyMetricsQuery;
    today: IsoDate;
  },
): Promise<HandlerResult<QuarterlyMetricsResponse, ValuechainsServiceError, unknown>> => {
  const { chainId, currentUserId, query, today } = input;

  const access = await verifyChainReadAccess(deps.accessRepo, chainId, currentUserId);
  if (!access.ok) {
    return buildMetricsFailure(
      access.status,
      access.status === 404 ? valuechainsErrorCodes.chainNotFound : valuechainsErrorCodes.structureLoadFailed,
      access.message,
      access.details,
    );
  }

  const range = resolveQuarterlyMetricsRange({
    fromYear: query.fromYear,
    fromQuarter: query.fromQuarter,
    toYear: query.toYear,
    toQuarter: query.toQuarter,
    at: query.at,
    today,
  });
  if (!range.ok) {
    return buildMetricsFailure(400, valuechainsErrorCodes.invalidRequest, "요청 파라미터가 올바르지 않습니다.");
  }

  const seriesResult = await deps.metricsRepo.findQuarterlySeries(chainId, range.from.year, range.to.year);
  if (!seriesResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.metricsFetchError, seriesResult.message);
  }
  const seriesParsed = QuarterlyMetricRowSchema.array().safeParse(seriesResult.data);
  if (!seriesParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "분기 지표 데이터 형식이 올바르지 않습니다.",
      seriesParsed.error.format(),
    );
  }

  // 경계 분기 절단 필터(순수 로직 — quarterOrdinal 비교).
  const fromOrdinal = range.from.year * 4 + (range.from.quarter - 1);
  const toOrdinal = range.to.year * 4 + (range.to.quarter - 1);
  const filteredSeries = seriesParsed.data.filter((row) => {
    const ordinal = row.calendar_year * 4 + (row.calendar_quarter - 1);
    return ordinal >= fromOrdinal && ordinal <= toOrdinal;
  });

  const currentResult = range.atQuarter
    ? await deps.metricsRepo.findQuarterlyByQuarter(chainId, range.atQuarter.calendarYear, range.atQuarter.calendarQuarter)
    : await deps.metricsRepo.findLatestQuarterly(chainId);
  if (!currentResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.metricsFetchError, currentResult.message);
  }
  const currentParsed = currentResult.data
    ? QuarterlyMetricRowSchema.safeParse(currentResult.data)
    : null;
  if (currentParsed && !currentParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "분기 현재값 데이터 형식이 올바르지 않습니다.",
      currentParsed.error.format(),
    );
  }

  const dto: QuarterlyMetricsResponse = {
    chainId,
    current: currentParsed?.success
      ? {
          calendarYear: currentParsed.data.calendar_year,
          calendarQuarter: currentParsed.data.calendar_quarter,
          totalRevenueKrw: currentParsed.data.total_revenue_krw,
          coveredNodeCount: currentParsed.data.covered_node_count,
          totalNodeCount: currentParsed.data.total_node_count,
          excludedUnmappedCount: currentParsed.data.excluded_unmapped_count,
          basedOnSnapshotId: currentParsed.data.based_on_snapshot_id,
        }
      : null,
    series: filteredSeries.map((row) => ({
      calendarYear: row.calendar_year,
      calendarQuarter: row.calendar_quarter,
      totalRevenueKrw: row.total_revenue_krw,
      coveredNodeCount: row.covered_node_count,
      totalNodeCount: row.total_node_count,
      excludedUnmappedCount: row.excluded_unmapped_count,
    })),
    annotations: {
      baseCurrency: "KRW",
      fxBasis: "quarter_end",
      revenueOverlapNotice: true,
    },
  };

  const responseParsed = QuarterlyMetricsResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.metricsValidationError,
      "분기 지표 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data);
};

// ============================================================================
// UC-011: 노드 클릭 상호작용(노드 상세 조회)
// ============================================================================

/** 노드 상세 조회 리포지토리 최소 인터페이스(테스트 시 mock 용이). */
export type NodeDetailRepository = {
  findChainById(chainId: string): Promise<unknown | null>;
  findNodeDetailRow(chainId: string, nodeId: string): Promise<{ row: unknown | null } | { dbError: string }>;
};

/** 노드 상세 조회 — spec Main Scenario 3~7, plan 모듈 5. */
export const getNodeDetail = async (
  repo: NodeDetailRepository,
  params: { chainId: string; nodeId: string },
  currentUserId: string | null,
): Promise<HandlerResult<NodeDetailResponse, ValuechainsServiceError, unknown>> => {
  const access = await verifyChainReadAccess(repo, params.chainId, currentUserId);
  if (!access.ok) {
    return buildMetricsFailure(
      access.status,
      access.status === 404 ? valuechainsErrorCodes.chainNotFound : valuechainsErrorCodes.internalError,
      access.message,
      access.details,
    );
  }

  const nodeResult = await repo.findNodeDetailRow(params.chainId, params.nodeId);
  if ("dbError" in nodeResult) {
    return buildMetricsFailure(500, valuechainsErrorCodes.internalError, nodeResult.dbError);
  }
  if (!nodeResult.row) {
    return buildMetricsFailure(404, valuechainsErrorCodes.nodeNotFound, "노드를 찾을 수 없습니다.");
  }

  const parsed = NodeDetailRowSchema.safeParse(nodeResult.row);
  if (!parsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.internalError,
      "노드 데이터 형식이 올바르지 않습니다.",
      parsed.error.format(),
    );
  }
  const row = parsed.data;

  const group = row.snapshot_groups ? { groupId: row.snapshot_groups.id, name: row.snapshot_groups.name } : null;

  const isFreeSubject = row.node_kind === "free_subject";
  const freeSubject = isFreeSubject
    ? { name: row.subject_name, subjectType: row.subject_type, memo: row.subject_memo }
    : null;

  const security =
    row.node_kind === "listed_company" && row.securities
      ? {
          securityId: row.securities.id,
          ticker: row.securities.ticker,
          market: row.securities.market,
          name: row.securities.name,
          listingStatus: row.securities.listing_status,
        }
      : null;

  const securityResolved = isFreeSubject ? true : security !== null;

  const dto: NodeDetailResponse = {
    nodeId: row.id,
    snapshotId: row.snapshot_id,
    nodeKind: row.node_kind,
    group,
    freeSubject,
    security,
    securityResolved,
  };

  const responseParsed = NodeDetailResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.internalError,
      "노드 상세 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data);
};

// ============================================================================
// UC-012: 시점 타임라인 조회(타임라인 메타/스냅샷 복원)
// ============================================================================

/** 타임라인 메타 조회 리포지토리 최소 인터페이스. */
export type TimelineRepository = {
  findChainById(chainId: string): Promise<unknown | null>;
};

/** 타임라인 메타(선택 가능 범위 + 스냅샷 마커) 조회 — spec §API(1), plan 모듈 9. */
export const getChainTimelineMeta = async (
  deps: { accessRepo: TimelineRepository; findMarkers: (chainId: string) => ReturnType<typeof findSnapshotMarkers> },
  chainId: string,
  currentUserId: string | null,
  now: Date,
): Promise<HandlerResult<TimelineMetaResponse, ValuechainsServiceError, unknown>> => {
  const access = await verifyChainReadAccess(deps.accessRepo, chainId, currentUserId);
  if (!access.ok) {
    return buildMetricsFailure(
      access.status,
      access.status === 404 ? valuechainsErrorCodes.chainNotFound : valuechainsErrorCodes.timelineQueryFailed,
      access.message,
      access.details,
    );
  }

  const markersResult = await deps.findMarkers(chainId);
  if (!markersResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.timelineQueryFailed, markersResult.message);
  }
  const markersParsed = SnapshotMarkerRowSchema.array().safeParse(markersResult.data);
  if (!markersParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "타임라인 마커 데이터 형식이 올바르지 않습니다.",
      markersParsed.error.format(),
    );
  }

  const today = todayInSeoul(now);
  const dto: TimelineMetaResponse = {
    range: { minDate: TIMESERIES_MIN_START_DATE, maxDate: today },
    markers: markersParsed.data.map((m) => ({
      snapshotId: m.id,
      effectiveAt: m.effective_at,
      changeSource: m.change_source,
    })),
  };

  const responseParsed = TimelineMetaResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "타임라인 메타 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data);
};

/** 시점 복원 조회 리포지토리 최소 인터페이스. */
export type SnapshotAtRepository = {
  findChainById(chainId: string): Promise<unknown | null>;
  findSnapshotStructureAt(
    chainId: string,
    asOfIso: string,
  ): ReturnType<typeof findSnapshotStructureAt>;
  findDailyMetricAt(chainId: string, date: string): ReturnType<typeof findDailyMetricAt>;
  findQuarterlyMetric(
    chainId: string,
    year: number,
    quarter: number,
  ): ReturnType<typeof findQuarterlyMetricRepo>;
};

/** 시점 D의 스냅샷 구조 + 해당 일자/분기 지표 복원 조회 — spec §API(2), plan 모듈 9. */
export const getChainSnapshotAt = async (
  repo: SnapshotAtRepository,
  chainId: string,
  date: IsoDate,
  currentUserId: string | null,
): Promise<HandlerResult<SnapshotAtResponse, ValuechainsServiceError, unknown>> => {
  const access = await verifyChainReadAccess(repo, chainId, currentUserId);
  if (!access.ok) {
    return buildMetricsFailure(
      access.status,
      access.status === 404 ? valuechainsErrorCodes.chainNotFound : valuechainsErrorCodes.timelineQueryFailed,
      access.message,
      access.details,
    );
  }

  const asOfIso = toSeoulDayEndIso(date);
  const structureResult = await repo.findSnapshotStructureAt(chainId, asOfIso);
  if (!structureResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.timelineQueryFailed, structureResult.message);
  }
  if (!structureResult.data) {
    return buildMetricsFailure(
      404,
      valuechainsErrorCodes.snapshotNotFound,
      "선택한 날짜 이전의 스냅샷을 찾을 수 없습니다.",
    );
  }

  const structureParsed = SnapshotAtRpcRowSchema.safeParse(structureResult.data);
  if (!structureParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "스냅샷 구조 데이터 형식이 올바르지 않습니다.",
      structureParsed.error.format(),
    );
  }
  const structure = structureParsed.data;

  const dailyResult = await repo.findDailyMetricAt(chainId, date);
  if (!dailyResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.timelineQueryFailed, dailyResult.message);
  }
  const dailyParsed = dailyResult.data ? DailyMetricRowSchema.safeParse(dailyResult.data) : null;
  if (dailyParsed && !dailyParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "일별 지표 데이터 형식이 올바르지 않습니다.",
      dailyParsed.error.format(),
    );
  }

  const { calendarYear, calendarQuarter } = dateToCalendarQuarter(date);
  const quarterlyResult = await repo.findQuarterlyMetric(chainId, calendarYear, calendarQuarter);
  if (!quarterlyResult.ok) {
    return buildMetricsFailure(500, valuechainsErrorCodes.timelineQueryFailed, quarterlyResult.message);
  }
  const quarterlyParsed = quarterlyResult.data
    ? QuarterlyMetricRowSchema.safeParse(quarterlyResult.data)
    : null;
  if (quarterlyParsed && !quarterlyParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "분기 지표 데이터 형식이 올바르지 않습니다.",
      quarterlyParsed.error.format(),
    );
  }

  const dto: SnapshotAtResponse = {
    snapshot: {
      snapshotId: structure.snapshot.id,
      effectiveAt: structure.snapshot.effective_at,
      changeSource: structure.snapshot.change_source,
      groups: structure.groups.map((g) => ({ id: g.id, name: g.name })),
      nodes: structure.nodes.map((n) => ({
        id: n.id,
        nodeKind: n.node_kind,
        groupId: n.group_id,
        security: n.security
          ? {
              securityId: n.security.id,
              ticker: n.security.ticker,
              market: n.security.market,
              name: n.security.name,
              listingStatus: n.security.listing_status,
            }
          : null,
        subjectName: n.subject_name,
        subjectType: n.subject_type,
        subjectMemo: n.subject_memo,
        positionX: n.position_x,
        positionY: n.position_y,
      })),
      edges: structure.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source_node_id,
        targetNodeId: e.target_node_id,
        relationType: {
          id: e.relation_type.id,
          name: e.relation_type.name,
          isDirected: e.relation_type.is_directed,
          isActive: e.relation_type.is_active,
        },
      })),
    },
    metrics: {
      daily:
        dailyParsed?.success
          ? {
              metricDate: dailyParsed.data.metric_date,
              totalMarketCapKrw:
                dailyParsed.data.total_market_cap_krw === null
                  ? null
                  : String(dailyParsed.data.total_market_cap_krw),
              coveredNodeCount: dailyParsed.data.covered_node_count,
              totalNodeCount: dailyParsed.data.total_node_count,
              // 집계 행 자체 이월 플래그 OR 당일 결측으로 직전 행 이월(BR-3).
              isCarriedForward: dailyParsed.data.is_carried_forward || dailyParsed.data.metric_date < date,
            }
          : null,
      quarterly:
        quarterlyParsed?.success
          ? {
              calendarYear: quarterlyParsed.data.calendar_year,
              calendarQuarter: quarterlyParsed.data.calendar_quarter,
              totalRevenueKrw:
                quarterlyParsed.data.total_revenue_krw === null
                  ? null
                  : String(quarterlyParsed.data.total_revenue_krw),
              coveredNodeCount: quarterlyParsed.data.covered_node_count,
              totalNodeCount: quarterlyParsed.data.total_node_count,
              excludedUnmappedCount: quarterlyParsed.data.excluded_unmapped_count,
            }
          : null,
    },
  };

  const responseParsed = SnapshotAtResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildMetricsFailure(
      500,
      valuechainsErrorCodes.timelineQueryFailed,
      "스냅샷 복원 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data);
};

// ============================================================================
// UC-016: 편집 대상 체인 최신 구성 조회(API-2 — 편집 캔버스 진입)
// ============================================================================

/** actor role 조회 최소 인터페이스 — 사용자 role(user/admin) 판별(R-2 권한 분기). */
export type FindActorRole = (userId: string) => Promise<{ role: "user" | "admin" } | null>;

const buildEditFailure = (
  status: number,
  code: ValuechainsServiceError,
  message: string,
  details?: unknown,
): HandlerResult<LatestSnapshotResponse, ValuechainsServiceError, unknown> =>
  failure(status, code, message, details);

/**
 * 편집 진입용 최신 구성 조회 — spec API-2, plan 모듈 M12 `getLatestSnapshot`.
 * R-2 권한 분기: 사용자 체인 + 비소유자 → 404(CHAIN_NOT_FOUND, 존재 비노출).
 *               공식 체인 + 비Admin → 403(CHAIN_FORBIDDEN).
 */
export const getLatestSnapshotForEdit = async (
  repo: ValuechainsViewRepository,
  findActorRole: FindActorRole,
  chainId: string,
  currentUserId: string,
): Promise<HandlerResult<LatestSnapshotResponse, ValuechainsServiceError, unknown>> => {
  try {
    const chainRow = await repo.findChainById(chainId);
    if (!chainRow) {
      return buildEditFailure(404, valuechainsErrorCodes.chainNotFound, "체인을 찾을 수 없습니다.");
    }

    const chainParsed = ValueChainRowSchema.safeParse(chainRow);
    if (!chainParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "체인 데이터 형식이 올바르지 않습니다.",
        chainParsed.error.format(),
      );
    }
    const chain = chainParsed.data;

    if (chain.is_archived) {
      return buildEditFailure(404, valuechainsErrorCodes.chainNotFound, "체인을 찾을 수 없습니다.");
    }

    if (chain.chain_type === "user") {
      if (chain.owner_id !== currentUserId) {
        // R-2/C-2: 존재 자체 비노출 — 404로 통일.
        return buildEditFailure(404, valuechainsErrorCodes.chainNotFound, "체인을 찾을 수 없습니다.");
      }
    } else {
      // official: Admin만 편집 진입 가능.
      const actorRole = await findActorRole(currentUserId);
      if (!actorRole || actorRole.role !== "admin") {
        return buildEditFailure(403, valuechainsErrorCodes.editChainForbidden, "관리자 권한이 필요합니다.");
      }
    }

    const snapshotRow = await repo.findLatestSnapshot(chainId);
    if (!snapshotRow) {
      return buildEditFailure(
        404,
        valuechainsErrorCodes.editSnapshotNotFound,
        "체인 구성 스냅샷을 찾을 수 없습니다.",
      );
    }
    const snapshotParsed = ChainSnapshotRowSchema.safeParse(snapshotRow);
    if (!snapshotParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "스냅샷 데이터 형식이 올바르지 않습니다.",
        snapshotParsed.error.format(),
      );
    }
    const snapshot = snapshotParsed.data;

    const [groupRows, nodeRows, edgeRows] = await Promise.all([
      repo.findSnapshotGroups(snapshot.id),
      repo.findSnapshotNodes(snapshot.id),
      repo.findSnapshotEdges(snapshot.id),
    ]);

    const groupsParsed = SnapshotGroupRowSchema.array().safeParse(groupRows);
    if (!groupsParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "그룹 데이터 형식이 올바르지 않습니다.",
        groupsParsed.error.format(),
      );
    }
    const nodesParsed = SnapshotNodeRowSchema.array().safeParse(nodeRows);
    if (!nodesParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "노드 데이터 형식이 올바르지 않습니다.",
        nodesParsed.error.format(),
      );
    }
    const edgesParsed = SnapshotEdgeRowSchema.array().safeParse(edgeRows);
    if (!edgesParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "엣지 데이터 형식이 올바르지 않습니다.",
        edgesParsed.error.format(),
      );
    }

    const dto: LatestSnapshotResponse = {
      chainId: chain.id,
      chainType: chain.chain_type,
      name: chain.name,
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
      snapshotId: snapshot.id,
      effectiveAt: snapshot.effective_at,
      groups: groupsParsed.data.map((g) => ({ id: g.id, name: g.name })),
      nodes: nodesParsed.data.map((node) => ({
        id: node.id,
        nodeKind: node.node_kind,
        groupId: node.group_id,
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
        positionX: node.position_x,
        positionY: node.position_y,
      })),
      edges: edgesParsed.data.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source_node_id,
        targetNodeId: edge.target_node_id,
        relationTypeId: edge.relation_type.id,
      })),
    };

    const responseParsed = LatestSnapshotResponseSchema.safeParse(dto);
    if (!responseParsed.success) {
      return buildEditFailure(
        500,
        valuechainsErrorCodes.editValidationError,
        "응답 데이터 형식이 올바르지 않습니다.",
        responseParsed.error.format(),
      );
    }

    return success(responseParsed.data);
  } catch (err) {
    if (err instanceof RepositoryError) {
      return buildEditFailure(500, valuechainsErrorCodes.editFetchFailed, err.message);
    }
    return buildEditFailure(
      500,
      valuechainsErrorCodes.editFetchFailed,
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
    );
  }
};

// ============================================================================
// UC-016: 저장 시 엣지 검증 헬퍼(R-4 매핑 — UC-018/021 저장 service가 호출)
// ============================================================================

/** R-4 매핑: 세분 사유(EdgeSaveViolation.reason) → 응답 코드(variant별). */
const EDGE_VIOLATION_CODE_MAP: Record<
  "user" | "official",
  Record<EdgeSaveViolation["reason"], ValuechainsServiceError>
> = {
  user: {
    EDGE_SELF_REFERENCE: valuechainsErrorCodes.invalidEdge,
    EDGE_DUPLICATE_RELATION: valuechainsErrorCodes.invalidEdge,
    EDGE_NODE_REF_INVALID: valuechainsErrorCodes.invalidEdge,
    RELATION_TYPE_NOT_FOUND: valuechainsErrorCodes.invalidRelationType,
    RELATION_TYPE_INACTIVE_FOR_NEW_EDGE: valuechainsErrorCodes.invalidRelationType,
  },
  official: {
    EDGE_SELF_REFERENCE: valuechainsErrorCodes.edgeSelfReference,
    EDGE_DUPLICATE_RELATION: valuechainsErrorCodes.edgeDuplicateRelation,
    EDGE_NODE_REF_INVALID: valuechainsErrorCodes.edgeNodeRefInvalid,
    RELATION_TYPE_NOT_FOUND: valuechainsErrorCodes.relationTypeNotFound,
    RELATION_TYPE_INACTIVE_FOR_NEW_EDGE: valuechainsErrorCodes.relationTypeInactiveForNewEdge,
  },
};

export interface ValidateEdgesForSaveInput {
  variant: "user" | "official";
  nodes: ReadonlyArray<{ clientNodeId: string; identity: NodeIdentity }>;
  edges: ReadonlyArray<SaveEdgePayload>;
  relationTypes: ReadonlyMap<string, { isDirected: boolean; isActive: boolean }>;
  /** null = 직전 스냅샷 없음(신규 저장). 사용자 체인은 조회 자체를 생략할 수 있다(R-1 불필요 쿼리 제거). */
  previousEdges: ReadonlyArray<PreviousEdgeIdentity> | null;
}

/**
 * 저장 엣지 검증 헬퍼(plan 모듈 M12) — `edgeSaveValidation.validateEdgesPayload`(도메인)에 위임하고,
 * 위반 목록을 R-4 규칙으로 HTTP 응답 코드에 매핑한다.
 * `variant`가 `enforceActiveForNewEdges`(official=true/user=false, R-1)와 응답 코드 셋(통합/세분)을 결정한다.
 */
export const validateEdgesForSave = (
  input: ValidateEdgesForSaveInput,
): HandlerResult<{ ok: true }, ValuechainsServiceError, unknown> => {
  const violations = validateEdgesPayload({
    nodes: input.nodes,
    edges: input.edges,
    relationTypes: input.relationTypes,
    previousEdges: input.previousEdges,
    enforceActiveForNewEdges: input.variant === "official",
  });

  if (violations.length === 0) {
    return success({ ok: true });
  }

  const first = violations[0]!;
  const code = EDGE_VIOLATION_CODE_MAP[input.variant][first.reason];

  return failure(422, code, "엣지 규칙을 위반했습니다.", {
    reason: first.reason,
    edge: first.edge,
    violations,
  });
};

// ============================================================================
// UC-014: 공식 체인 복제 (`POST /valuechains/:chainId/clone`)
// ============================================================================

/** service가 의존하는 최소 인터페이스 — repository 구현을 알지 못한다(테스트 시 mock 용이). */
export type CloneRepository = ValuechainsCloneRepository;

/** RPC 이름 유니크 위반(23505) 1회 재시도 한도(spec Edge 10, plan 모듈 7). */
const CLONE_NAME_CONFLICT_MAX_RETRY = 1;
const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

const buildCloneFailure = (
  status: number,
  code: ValuechainsServiceError,
  message: string,
  details?: unknown,
): HandlerResult<CloneChainResponse, ValuechainsServiceError, unknown> =>
  failure(status, code, message, details);

/**
 * 공식 체인 복제 — spec Main 5~10, plan 모듈 7. repository 인터페이스에만 의존한다.
 * 검증 순서(고정): 원본 조회/보관 → 공식 체인 여부 → 보유 체인 상한 → 최신 스냅샷 존재 →
 * 방어적 노드 상한 → 이름 결정 → RPC 실행(이름 경합 1회 재시도) → 응답 스키마 검증.
 */
export const cloneOfficialChain = async (
  repo: CloneRepository,
  userId: string,
  chainId: string,
): Promise<HandlerResult<CloneChainResponse, ValuechainsServiceError, unknown>> => {
  // 1. 원본 체인 조회 + 보관 판정(Edge 4).
  const sourceRow = await repo.findChainHeaderById(chainId);
  if (!sourceRow) {
    return buildCloneFailure(404, valuechainsErrorCodes.sourceChainNotFound, "원본 체인을 찾을 수 없습니다.");
  }
  const sourceParsed = CloneSourceChainRowSchema.safeParse(sourceRow);
  if (!sourceParsed.success) {
    return buildCloneFailure(
      500,
      valuechainsErrorCodes.cloneFailed,
      "원본 체인 데이터 형식이 올바르지 않습니다.",
      sourceParsed.error.format(),
    );
  }
  const source = sourceParsed.data;

  if (source.is_archived) {
    return buildCloneFailure(404, valuechainsErrorCodes.sourceChainNotFound, "원본 체인을 찾을 수 없습니다.");
  }

  // 2. 공식 체인만 복제 대상(Edge 7).
  if (source.chain_type !== "official") {
    return buildCloneFailure(422, valuechainsErrorCodes.invalidCloneSource, "복제 대상은 공식 체인만 가능합니다.");
  }

  // 3. 1인당 체인 상한(Edge 2, BR-7).
  const ownedChainCount = await repo.countChainsByOwner(userId);
  if (ownedChainCount >= MAX_CHAINS_PER_USER) {
    return buildCloneFailure(
      409,
      valuechainsErrorCodes.chainLimitExceeded,
      "밸류체인 보유 상한에 도달했습니다.",
    );
  }

  // 4. 원본 최신 스냅샷(Edge 6).
  const snapshotRow = await repo.findLatestSnapshot(chainId);
  if (!snapshotRow) {
    return buildCloneFailure(
      422,
      valuechainsErrorCodes.sourceSnapshotMissing,
      "원본 체인에 스냅샷이 존재하지 않습니다.",
    );
  }
  const snapshotParsed = CloneLatestSnapshotRowSchema.safeParse(snapshotRow);
  if (!snapshotParsed.success) {
    return buildCloneFailure(
      500,
      valuechainsErrorCodes.cloneFailed,
      "원본 스냅샷 데이터 형식이 올바르지 않습니다.",
      snapshotParsed.error.format(),
    );
  }
  const snapshot = snapshotParsed.data;

  // 5. 방어적 노드 상한 검증(Edge 5 — 정상 데이터에선 발생 불가, 비정상 데이터만 차단).
  const composition = await repo.countSnapshotComposition(snapshot.id);
  if (composition.nodeCount > MAX_NODES_PER_CHAIN) {
    return buildCloneFailure(
      422,
      valuechainsErrorCodes.invalidCloneSource,
      "원본 체인의 노드 수가 상한을 초과했습니다.",
    );
  }

  // 6. 복제본 이름 결정(Main 8, D-4).
  let existingNames = await repo.listChainNamesByOwner(userId);
  let resolvedName = resolveCloneName(source.name, existingNames);

  // 7. RPC 실행 — 이름 경합(23505) 1회 재시도(Edge 10).
  let rpcResult: unknown;
  let attempt = 0;
  for (;;) {
    try {
      rpcResult = await repo.executeCloneChainRpc({
        sourceChainId: chainId,
        sourceSnapshotId: snapshot.id,
        ownerId: userId,
        name: resolvedName,
      });
      break;
    } catch (err) {
      const isUniqueViolation =
        err instanceof CloneRpcError && err.code === POSTGRES_UNIQUE_VIOLATION_CODE;
      if (isUniqueViolation && attempt < CLONE_NAME_CONFLICT_MAX_RETRY) {
        attempt += 1;
        existingNames = await repo.listChainNamesByOwner(userId);
        resolvedName = resolveCloneName(source.name, existingNames);
        continue;
      }
      return buildCloneFailure(
        500,
        valuechainsErrorCodes.cloneFailed,
        "체인 복제 처리 중 오류가 발생했습니다.",
      );
    }
  }

  // 8. RPC 결과 검증.
  const rpcParsed = CloneRpcResultSchema.safeParse(rpcResult);
  if (!rpcParsed.success) {
    return buildCloneFailure(
      500,
      valuechainsErrorCodes.cloneFailed,
      "복제 결과 데이터 형식이 올바르지 않습니다.",
      rpcParsed.error.format(),
    );
  }
  const rpc = rpcParsed.data;

  // 9. DTO 조립 + 최종 응답 스키마 검증.
  const dto: CloneChainResponse = {
    chainId: rpc.chain_id,
    name: resolvedName,
    chainType: "user",
    focusType: source.focus_type,
    focusSecurityId: source.focus_security_id,
    sourceChainId: chainId,
    snapshotId: rpc.snapshot_id,
    clonedAt: rpc.cloned_at,
    nodeCount: rpc.node_count,
    edgeCount: rpc.edge_count,
    groupCount: rpc.group_count,
  };

  const responseParsed = CloneChainResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return buildCloneFailure(
      500,
      valuechainsErrorCodes.cloneFailed,
      "복제 응답 데이터 형식이 올바르지 않습니다.",
      responseParsed.error.format(),
    );
  }

  return success(responseParsed.data, 201);
};

// ============================================================================
// UC-019: 사용자 체인 삭제 (`DELETE /valuechains/:chainId`)
// ============================================================================

/** service가 의존하는 최소 인터페이스 — repository 구현을 알지 못한다(테스트 시 mock 용이). */
export type DeleteRepository = ValuechainsDeleteRepository;

const buildDeleteFailure = (
  status: number,
  code: ValuechainsServiceError,
  message: string,
): HandlerResult<null, ValuechainsServiceError, unknown> => failure(status, code, message);

/**
 * 사용자 체인 삭제 — spec Main 6~8, plan 모듈 4. repository 인터페이스에만 의존한다.
 * 검증 순서(고정, spec Main 6): 미존재(멱등 204, Edge 3/BR-4) → 공식 체인(403, Edge 2/BR-1) →
 * 소유자 불일치(403, Edge 1/BR-2) → 삭제 실행(500, Edge 4 — DB CASCADE가 원자성 보장).
 */
export const deleteUserChain = async (
  repo: DeleteRepository,
  userId: string,
  chainId: string,
): Promise<HandlerResult<null, ValuechainsServiceError, unknown>> => {
  let ownershipRow: unknown;
  try {
    ownershipRow = await repo.findChainOwnershipById(chainId);
  } catch (err) {
    return buildDeleteFailure(
      500,
      valuechainsErrorCodes.internalError,
      err instanceof RepositoryError ? err.message : "체인 조회 중 오류가 발생했습니다.",
    );
  }

  // 1. 미존재(이미 삭제됨) → 멱등 성공(BR-4).
  if (!ownershipRow) {
    return success(null, 204);
  }

  const parsed = DeleteTargetChainRowSchema.safeParse(ownershipRow);
  if (!parsed.success) {
    return buildDeleteFailure(500, valuechainsErrorCodes.internalError, "체인 데이터 형식이 올바르지 않습니다.");
  }
  const chain = parsed.data;

  // 2. 공식 체인은 물리 삭제 금지(BR-1) — 소유자 검증보다 먼저 판정.
  if (chain.chain_type === "official") {
    return buildDeleteFailure(
      403,
      valuechainsErrorCodes.officialChainDeleteForbidden,
      "공식 체인은 삭제할 수 없습니다. 관리자 보관 처리를 이용해 주세요.",
    );
  }

  // 3. 소유자 본인만 삭제 가능(BR-2). owner_id가 null인 user 체인은 CHECK 제약상 불가능하지만 방어적으로 거부.
  if (chain.owner_id === null || chain.owner_id !== userId) {
    return buildDeleteFailure(403, valuechainsErrorCodes.chainForbidden, "체인을 삭제할 권한이 없습니다.");
  }

  // 4. 삭제 실행(단일 DELETE + FK CASCADE — DB 원자성).
  const deleteResult = await repo.deleteUserChainById(chainId, userId);
  if (!deleteResult.ok) {
    return buildDeleteFailure(500, valuechainsErrorCodes.internalError, deleteResult.message);
  }

  return success(null, 204);
};

// ============================================================================
// UC-018: 밸류체인 저장 (`POST /valuechains` · `PUT /valuechains/:chainId`)
// ============================================================================

/** service가 의존하는 최소 인터페이스 — repository 구현을 알지 못한다(테스트 시 mock 용이). */
export type SaveRepository = ValuechainsSaveRepository;

/** 종목 존재 확인 최소 인터페이스(securities feature 캡슐화 — R-13). */
export type SecuritiesExistenceRepository = {
  findExistingSecurityIds: (ids: string[]) => Promise<{ foundIds: Set<string> } | { error: string }>;
};

/** 관계 종류 마스터 조회 최소 인터페이스(relation-types feature 캡슐화). */
export type RelationTypesRepository = {
  findAllRelationTypes: () => Promise<{ rows: unknown[]; error: string | null }>;
};

export interface SaveUserChainDeps {
  saveRepo: SaveRepository;
  securitiesRepo: SecuritiesExistenceRepository;
  relationTypesRepo: RelationTypesRepository;
}

export interface SaveUserChainInput {
  userId: string;
  chainId: string | null;
  body: SaveChainRequest;
}

const buildSaveFailure = (
  status: number,
  code: ValuechainsServiceError,
  message: string,
  details?: unknown,
): HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown> => failure(status, code, message, details);

/** UC-018 §6.2 구조 위반(reason)→ 사용자 체인 저장 응답 코드 매핑(통합 코드 — 세분 사유는 details.reason). */
const STRUCTURE_VIOLATION_CODE_MAP: Record<StructureViolation["reason"], ValuechainsServiceError> = {
  NODE_LIMIT_EXCEEDED: valuechainsErrorCodes.saveNodeLimitExceeded,
  NODE_KIND_FIELD_MISMATCH: valuechainsErrorCodes.saveInvalidNode,
  DUPLICATE_SECURITY_NODE: valuechainsErrorCodes.saveDuplicateSecurityNode,
  GROUP_NAME_REQUIRED: valuechainsErrorCodes.saveInvalidGroup,
  GROUP_REF_INVALID: valuechainsErrorCodes.saveInvalidGroup,
  DUPLICATE_CLIENT_ID: valuechainsErrorCodes.saveInvalidRequest,
};

/** 대표 코드 우선순위(복수 위반 유형 공존 시 결정적 응답 — spec §6.2). */
const STRUCTURE_VIOLATION_PRIORITY: StructureViolation["reason"][] = [
  "NODE_LIMIT_EXCEEDED",
  "NODE_KIND_FIELD_MISMATCH",
  "DUPLICATE_SECURITY_NODE",
  "GROUP_NAME_REQUIRED",
  "GROUP_REF_INVALID",
  "DUPLICATE_CLIENT_ID",
];

function pickRepresentativeViolation(violations: StructureViolation[]): StructureViolation {
  for (const reason of STRUCTURE_VIOLATION_PRIORITY) {
    const found = violations.find((v) => v.reason === reason);
    if (found) {
      return found;
    }
  }
  return violations[0]!;
}

function toNodeIdentity(node: SaveChainNodePayload): NodeIdentity {
  if (node.nodeKind === "listed_company") {
    return { kind: "listed_company", securityId: node.securityId as string };
  }
  return {
    kind: "free_subject",
    subjectName: node.subjectName as string,
    subjectType: node.subjectType as string,
  };
}

/**
 * 사용자 체인 저장(신규/갱신) — spec Main 1~9, plan 모듈 10.
 * repository 인터페이스에만 의존한다(테이블 직접 접근 없음). 검증 순서(고정):
 * 모드 검증 → (갱신) 대상/권한/낙관적 잠금 → (신규) 상한 → 이름 중복 → 구조 재검증(BR-5)
 * → 참조 존재(securities/relation_types) → 엣지 검증(UC-016) → RPC 저장 → 응답 검증.
 */
export const saveUserChain = async (
  deps: SaveUserChainDeps,
  input: SaveUserChainInput,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown>> => {
  const { userId, chainId, body } = input;

  // 정규화(S-9, R-14): focusType='industry'면 focusSecurityId를 서버가 강제 null 처리.
  const focusSecurityId = body.focusType === "industry" ? null : body.focusSecurityId;

  // 모드 검증: 신규=baseSnapshotId null 필수, 갱신=필수(스키마 밖 — service 소관, S-6).
  if (chainId === null && body.baseSnapshotId !== null) {
    return buildSaveFailure(400, valuechainsErrorCodes.saveInvalidRequest, "신규 저장은 baseSnapshotId를 지정할 수 없습니다.");
  }
  if (chainId !== null && body.baseSnapshotId === null) {
    return buildSaveFailure(400, valuechainsErrorCodes.saveInvalidRequest, "갱신 저장은 baseSnapshotId가 필요합니다.");
  }

  try {
    if (chainId !== null) {
      // 갱신 대상 검증(E11/E10/BR-10).
      const chainMeta = await deps.saveRepo.findChainMetaById(chainId);
      if (!chainMeta || chainMeta.is_archived) {
        return buildSaveFailure(404, valuechainsErrorCodes.saveNotFound, "체인을 찾을 수 없습니다.");
      }
      if (chainMeta.chain_type !== "user" || chainMeta.owner_id !== userId) {
        return buildSaveFailure(403, valuechainsErrorCodes.saveForbidden, "체인을 저장할 권한이 없습니다.");
      }

      // 낙관적 잠금 사전 확인(빠른 실패 — 최종 강제는 RPC, BR-7).
      const latestSnapshot = await deps.saveRepo.findLatestSnapshotHeader(chainId);
      if (!latestSnapshot || latestSnapshot.id !== body.baseSnapshotId) {
        return buildSaveFailure(409, valuechainsErrorCodes.saveConflict, "다른 곳에서 이 체인이 먼저 저장되었습니다.");
      }
    } else {
      // 신규 저장 상한(E2).
      const ownedCount = await deps.saveRepo.countOwnedUserChains(userId);
      if (ownedCount >= MAX_CHAINS_PER_USER) {
        return buildSaveFailure(422, valuechainsErrorCodes.saveChainLimitExceeded, "밸류체인 보유 상한에 도달했습니다.");
      }
    }

    // 이름 중복(E4, BR-4).
    const nameDuplicate = await deps.saveRepo.existsChainNameForOwner(userId, body.name, chainId);
    if (nameDuplicate) {
      return buildSaveFailure(409, valuechainsErrorCodes.saveDuplicateName, "이미 사용 중인 체인 이름입니다.");
    }

    // 구조 재검증(BR-5) — 노드/그룹 규칙.
    const structureViolations = validateChainStructure({
      groups: body.groups,
      nodes: body.nodes,
      edges: body.edges,
    });
    if (structureViolations.length > 0) {
      const representative = pickRepresentativeViolation(structureViolations);
      const code = STRUCTURE_VIOLATION_CODE_MAP[representative.reason];
      return buildSaveFailure(
        code === valuechainsErrorCodes.saveInvalidRequest ? 400 : 422,
        code,
        "구조 규칙을 위반했습니다.",
        { violations: structureViolations },
      );
    }

    // 빈 그룹 정리(UC-017 BR-6) — 소속 노드 0개 그룹은 스냅샷에서 제외한다(오류 아님).
    // deps에 logger가 없어 prunedGroupIds는 로깅하지 않는다(정리 자체가 핵심 동작).
    const { groups: prunedGroups } = pruneEmptyGroups(body.groups, body.nodes);

    // 참조 존재 검증(E12/S-9): nodes[].securityId ∪ focusSecurityId.
    const securityIdsToCheck = [
      ...body.nodes.filter((n) => n.securityId !== null).map((n) => n.securityId as string),
      ...(focusSecurityId !== null ? [focusSecurityId] : []),
    ];
    const securityResult = await deps.securitiesRepo.findExistingSecurityIds(securityIdsToCheck);
    if ("error" in securityResult) {
      return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, securityResult.error);
    }
    const missingSecurityNodeIds = body.nodes
      .filter((n) => n.securityId !== null && !securityResult.foundIds.has(n.securityId))
      .map((n) => n.clientNodeId);
    const focusSecurityMissing = focusSecurityId !== null && !securityResult.foundIds.has(focusSecurityId);
    if (missingSecurityNodeIds.length > 0 || focusSecurityMissing) {
      return buildSaveFailure(422, valuechainsErrorCodes.saveSecurityNotFound, "존재하지 않는 종목을 참조합니다.", {
        clientNodeIds: missingSecurityNodeIds,
        ...(focusSecurityMissing ? { field: "focusSecurityId" } : {}),
      });
    }

    // 엣지 검증(UC-016 위임, user variant — 비활성 종류 신규 차단 없음, BR-8).
    const relationTypesResult = await deps.relationTypesRepo.findAllRelationTypes();
    if (relationTypesResult.error) {
      return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, relationTypesResult.error);
    }
    const relationTypeById = new Map<string, { isDirected: boolean; isActive: boolean }>();
    for (const row of relationTypesResult.rows as Array<{ id: string; is_directed: boolean; is_active: boolean }>) {
      relationTypeById.set(row.id, { isDirected: row.is_directed, isActive: row.is_active });
    }

    const edgeValidation = validateEdgesForSave({
      variant: "user",
      nodes: body.nodes.map((n) => ({ clientNodeId: n.clientNodeId, identity: toNodeIdentity(n) })),
      edges: body.edges,
      relationTypes: relationTypeById,
      previousEdges: null,
    });
    if (!edgeValidation.ok) {
      return edgeValidation;
    }

    // 저장 RPC 호출.
    let rpcResult: unknown;
    try {
      rpcResult = await deps.saveRepo.saveUserChainViaRpc({
        userId,
        chainId,
        baseSnapshotId: body.baseSnapshotId,
        name: body.name,
        focusType: body.focusType,
        focusSecurityId,
        groups: prunedGroups,
        nodes: body.nodes,
        edges: body.edges,
        maxChainsPerUser: MAX_CHAINS_PER_USER,
        maxNodesPerChain: MAX_NODES_PER_CHAIN,
      });
    } catch (err) {
      if (err instanceof SaveRpcError) {
        if (err.pgCode === "23505") {
          return buildSaveFailure(409, valuechainsErrorCodes.saveDuplicateName, "이미 사용 중인 체인 이름입니다.");
        }
        return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, err.message);
      }
      return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, "저장 처리 중 오류가 발생했습니다.");
    }

    const rpcParsed = SaveRpcResultSchema.safeParse(rpcResult);
    if (!rpcParsed.success) {
      return buildSaveFailure(
        500,
        valuechainsErrorCodes.saveFailed,
        "저장 결과 데이터 형식이 올바르지 않습니다.",
        rpcParsed.error.format(),
      );
    }
    const rpc = rpcParsed.data;

    switch (rpc.outcome) {
      case "saved":
        break;
      case "chain_limit_exceeded":
        return buildSaveFailure(422, valuechainsErrorCodes.saveChainLimitExceeded, "밸류체인 보유 상한에 도달했습니다.");
      case "node_limit_exceeded":
        return buildSaveFailure(422, valuechainsErrorCodes.saveNodeLimitExceeded, "노드 상한을 초과했습니다.");
      case "chain_not_found":
        return buildSaveFailure(404, valuechainsErrorCodes.saveNotFound, "체인을 찾을 수 없습니다.");
      case "chain_forbidden":
        return buildSaveFailure(403, valuechainsErrorCodes.saveForbidden, "체인을 저장할 권한이 없습니다.");
      case "save_conflict":
        return buildSaveFailure(409, valuechainsErrorCodes.saveConflict, "다른 곳에서 이 체인이 먼저 저장되었습니다.");
      case "name_duplicate":
        return buildSaveFailure(409, valuechainsErrorCodes.saveDuplicateName, "이미 사용 중인 체인 이름입니다.");
      case "edge_node_ref_invalid":
        return buildSaveFailure(422, valuechainsErrorCodes.invalidEdge, "엣지가 참조하는 노드를 찾을 수 없습니다.");
      default:
        return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, "저장 처리 중 알 수 없는 오류가 발생했습니다.");
    }

    const dto: SaveChainResult = {
      chainId: rpc.chain_id as string,
      snapshotId: rpc.snapshot_id as string,
      effectiveAt: rpc.effective_at as string,
      nodeCount: rpc.node_count as number,
      edgeCount: rpc.edge_count as number,
      groupCount: rpc.group_count as number,
    };

    const responseParsed = SaveChainResponseSchema.safeParse(dto);
    if (!responseParsed.success) {
      return buildSaveFailure(
        500,
        valuechainsErrorCodes.saveFailed,
        "저장 응답 데이터 형식이 올바르지 않습니다.",
        responseParsed.error.format(),
      );
    }

    return success(responseParsed.data, chainId === null ? 201 : 200);
  } catch (err) {
    if (err instanceof RepositoryError) {
      return buildSaveFailure(500, valuechainsErrorCodes.saveFailed, err.message);
    }
    return buildSaveFailure(
      500,
      valuechainsErrorCodes.saveFailed,
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
    );
  }
};

// ============================================================================
// UC-021: 공식 밸류체인 저장 (`POST/PUT /valuechains` official 분기)
// ============================================================================

export interface SaveOfficialChainDeps {
  officialSaveRepo: OfficialSaveRepository;
  saveRepo: SaveRepository;
  securitiesRepo: SecuritiesExistenceRepository;
  relationTypesRepo: RelationTypesRepository;
  /** 갱신 저장의 비활성 관계 종류 "기존 엣지 유지" 판별용(UC-016 BR-4) — chainId의 최신 스냅샷 엣지 정체성. */
  findPreviousEdgeIdentities: (chainId: string) => Promise<ReadonlyArray<PreviousEdgeIdentity> | null>;
}

/** M1 매핑 표 — official 저장은 UC-018과 달리 GROUP_* 세분 코드를 그대로 사용한다(R-13). */
const OFFICIAL_STRUCTURE_VIOLATION_CODE_MAP: Record<StructureViolation["reason"], ValuechainsServiceError> = {
  NODE_LIMIT_EXCEEDED: valuechainsErrorCodes.saveNodeLimitExceeded,
  NODE_KIND_FIELD_MISMATCH: valuechainsErrorCodes.saveInvalidNode,
  DUPLICATE_SECURITY_NODE: valuechainsErrorCodes.saveDuplicateSecurityNode,
  GROUP_NAME_REQUIRED: valuechainsErrorCodes.officialGroupNameRequired,
  GROUP_REF_INVALID: valuechainsErrorCodes.officialGroupRefInvalid,
  DUPLICATE_CLIENT_ID: valuechainsErrorCodes.saveInvalidRequest,
};

async function validateOfficialStructureAndReferences(
  deps: SaveOfficialChainDeps,
  body: SaveOfficialChainRequestBody,
  focusSecurityId: string | null,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown> | null> {
  const structureViolations = validateChainStructure({ groups: body.groups, nodes: body.nodes, edges: body.edges });
  if (structureViolations.length > 0) {
    const representative = pickRepresentativeViolation(structureViolations);
    const code = OFFICIAL_STRUCTURE_VIOLATION_CODE_MAP[representative.reason];
    return failure(
      code === valuechainsErrorCodes.saveInvalidRequest ? 400 : 422,
      code,
      "구조 규칙을 위반했습니다.",
      { violations: structureViolations },
    );
  }

  const securityIdsToCheck = [
    ...body.nodes.filter((n) => n.securityId !== null).map((n) => n.securityId as string),
    ...(focusSecurityId !== null ? [focusSecurityId] : []),
  ];
  const securityResult = await deps.securitiesRepo.findExistingSecurityIds(securityIdsToCheck);
  if ("error" in securityResult) {
    return failure(500, valuechainsErrorCodes.saveFailed, securityResult.error);
  }
  const missingSecurityNodeIds = body.nodes
    .filter((n) => n.securityId !== null && !securityResult.foundIds.has(n.securityId))
    .map((n) => n.clientNodeId);
  const focusSecurityMissing = focusSecurityId !== null && !securityResult.foundIds.has(focusSecurityId);
  if (missingSecurityNodeIds.length > 0 || focusSecurityMissing) {
    return failure(422, valuechainsErrorCodes.saveSecurityNotFound, "존재하지 않는 종목을 참조합니다.", {
      clientNodeIds: missingSecurityNodeIds,
      ...(focusSecurityMissing ? { field: "focusSecurityId" } : {}),
    });
  }

  return null;
}

async function validateOfficialEdges(
  deps: SaveOfficialChainDeps,
  body: SaveOfficialChainRequestBody,
  previousEdges: ReadonlyArray<PreviousEdgeIdentity> | null,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown> | null> {
  const relationTypesResult = await deps.relationTypesRepo.findAllRelationTypes();
  if (relationTypesResult.error) {
    return failure(500, valuechainsErrorCodes.saveFailed, relationTypesResult.error);
  }
  const relationTypeById = new Map<string, { isDirected: boolean; isActive: boolean }>();
  for (const row of relationTypesResult.rows as Array<{ id: string; is_directed: boolean; is_active: boolean }>) {
    relationTypeById.set(row.id, { isDirected: row.is_directed, isActive: row.is_active });
  }

  const edgeValidation = validateEdgesForSave({
    variant: "official",
    nodes: body.nodes.map((n) => ({ clientNodeId: n.clientNodeId, identity: toNodeIdentity(n) })),
    edges: body.edges,
    relationTypes: relationTypeById,
    previousEdges,
  });
  if (!edgeValidation.ok) {
    return edgeValidation;
  }
  return null;
}

function mapOfficialRpcOutcome(
  outcome: string,
): { status: number; code: ValuechainsServiceError; message: string } | null {
  switch (outcome) {
    case "saved":
      return null;
    case "node_limit_exceeded":
      return { status: 422, code: valuechainsErrorCodes.saveNodeLimitExceeded, message: "노드 상한을 초과했습니다." };
    case "chain_not_found":
      return { status: 404, code: valuechainsErrorCodes.saveNotFound, message: "체인을 찾을 수 없습니다." };
    case "chain_type_mismatch":
      return { status: 404, code: valuechainsErrorCodes.saveNotFound, message: "체인을 찾을 수 없습니다." };
    case "chain_archived":
      return { status: 409, code: valuechainsErrorCodes.chainArchived, message: "보관된 체인은 수정할 수 없습니다." };
    case "save_conflict":
      return { status: 409, code: valuechainsErrorCodes.saveConflict, message: "다른 곳에서 이 체인이 먼저 저장되었습니다." };
    case "name_duplicate":
      return { status: 409, code: valuechainsErrorCodes.officialNameDuplicate, message: "이미 사용 중인 공식 체인 이름입니다." };
    case "edge_node_ref_invalid":
      return { status: 422, code: valuechainsErrorCodes.invalidEdge, message: "엣지가 참조하는 노드를 찾을 수 없습니다." };
    default:
      return { status: 500, code: valuechainsErrorCodes.saveFailed, message: "저장 처리 중 알 수 없는 오류가 발생했습니다." };
  }
}

async function finalizeOfficialSave(
  deps: SaveOfficialChainDeps,
  rpcParams: Parameters<OfficialSaveRepository["saveOfficialChainRpc"]>[0],
  successStatus: number,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown>> {
  let rpcResult: unknown;
  try {
    rpcResult = await deps.officialSaveRepo.saveOfficialChainRpc(rpcParams);
  } catch (err) {
    if (err instanceof SaveRpcError) {
      if (err.pgCode === "23505") {
        return failure(409, valuechainsErrorCodes.officialNameDuplicate, "이미 사용 중인 공식 체인 이름입니다.");
      }
      return failure(500, valuechainsErrorCodes.saveFailed, err.message);
    }
    return failure(500, valuechainsErrorCodes.saveFailed, "저장 처리 중 오류가 발생했습니다.");
  }

  const rpcParsed = SaveRpcResultSchema.safeParse(rpcResult);
  if (!rpcParsed.success) {
    return failure(500, valuechainsErrorCodes.saveFailed, "저장 결과 데이터 형식이 올바르지 않습니다.", rpcParsed.error.format());
  }
  const rpc = rpcParsed.data;

  const outcomeError = mapOfficialRpcOutcome(rpc.outcome);
  if (outcomeError) {
    return failure(outcomeError.status, outcomeError.code, outcomeError.message);
  }

  const dto: SaveChainResult = {
    chainId: rpc.chain_id as string,
    snapshotId: rpc.snapshot_id as string,
    effectiveAt: rpc.effective_at as string,
    nodeCount: rpc.node_count as number,
    edgeCount: rpc.edge_count as number,
    groupCount: rpc.group_count as number,
  };
  const responseParsed = SaveChainResponseSchema.safeParse(dto);
  if (!responseParsed.success) {
    return failure(500, valuechainsErrorCodes.saveFailed, "저장 응답 데이터 형식이 올바르지 않습니다.", responseParsed.error.format());
  }

  return success(responseParsed.data, successStatus);
}

/**
 * 공식 체인 생성(UC-021 spec Main 4-B, plan 모듈 M6) — role은 route가 이미 401/403으로 선차단했다는
 * 전제(`withAdminAuth` 미사용 — POST /valuechains는 공용 라우트이므로 이 함수가 role 재검증한다).
 */
export const createOfficialChain = async (
  deps: SaveOfficialChainDeps,
  actor: { userId: string; role: "user" | "admin" },
  body: SaveOfficialChainRequestBody,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown>> => {
  if (actor.role !== "admin") {
    return failure(403, valuechainsErrorCodes.adminRequired, "관리자 권한이 필요합니다.");
  }

  const focusSecurityId = body.focusType === "industry" ? null : body.focusSecurityId;

  if (body.baseSnapshotId !== null) {
    return failure(400, valuechainsErrorCodes.saveInvalidRequest, "신규 저장은 baseSnapshotId를 지정할 수 없습니다.");
  }

  const structureFailure = await validateOfficialStructureAndReferences(deps, body, focusSecurityId);
  if (structureFailure) {
    return structureFailure;
  }

  const edgeFailure = await validateOfficialEdges(deps, body, null);
  if (edgeFailure) {
    return edgeFailure;
  }

  const nameDuplicate = await deps.officialSaveRepo.existsOfficialChainName(body.name, null);
  if (nameDuplicate) {
    return failure(409, valuechainsErrorCodes.officialNameDuplicate, "이미 사용 중인 공식 체인 이름입니다.");
  }

  // 빈 그룹 정리(UC-017 BR-6) — 소속 노드 0개 그룹은 스냅샷에서 제외.
  const { groups: createPrunedGroups } = pruneEmptyGroups(body.groups, body.nodes);

  return finalizeOfficialSave(
    deps,
    {
      chainId: null,
      name: body.name,
      focusType: body.focusType,
      focusSecurityId,
      disclosureDate: body.disclosureDate ?? null,
      baseSnapshotId: null,
      createdBy: actor.userId,
      groups: createPrunedGroups,
      nodes: body.nodes,
      edges: body.edges,
      maxNodesPerChain: MAX_NODES_PER_CHAIN,
    },
    201,
  );
};

/**
 * 공식 체인 수정(UC-021 spec Main 4-C, plan 모듈 M6).
 */
export const updateOfficialChain = async (
  deps: SaveOfficialChainDeps,
  actor: { userId: string; role: "user" | "admin" },
  chainId: string,
  body: SaveOfficialChainRequestBody,
): Promise<HandlerResult<SaveChainResponse, ValuechainsServiceError, unknown>> => {
  if (actor.role !== "admin") {
    return failure(403, valuechainsErrorCodes.adminRequired, "관리자 권한이 필요합니다.");
  }

  const focusSecurityId = body.focusType === "industry" ? null : body.focusSecurityId;

  if (body.baseSnapshotId === null) {
    return failure(400, valuechainsErrorCodes.saveInvalidRequest, "갱신 저장은 baseSnapshotId가 필요합니다.");
  }

  const chainMeta = await deps.saveRepo.findChainMetaById(chainId);
  if (!chainMeta) {
    return failure(404, valuechainsErrorCodes.saveNotFound, "체인을 찾을 수 없습니다.");
  }
  if (chainMeta.chain_type !== "official") {
    // 방어적 404 — M7 디스패치가 이미 이 경로를 선차단(레이스 대비).
    return failure(404, valuechainsErrorCodes.saveNotFound, "체인을 찾을 수 없습니다.");
  }
  if (chainMeta.is_archived) {
    return failure(409, valuechainsErrorCodes.chainArchived, "보관된 체인은 수정할 수 없습니다.");
  }

  const structureFailure = await validateOfficialStructureAndReferences(deps, body, focusSecurityId);
  if (structureFailure) {
    return structureFailure;
  }

  const previousEdges = await deps.findPreviousEdgeIdentities(chainId);

  const edgeFailure = await validateOfficialEdges(deps, body, previousEdges);
  if (edgeFailure) {
    return edgeFailure;
  }

  const nameDuplicate = await deps.officialSaveRepo.existsOfficialChainName(body.name, chainId);
  if (nameDuplicate) {
    return failure(409, valuechainsErrorCodes.officialNameDuplicate, "이미 사용 중인 공식 체인 이름입니다.");
  }

  // 빈 그룹 정리(UC-017 BR-6) — 소속 노드 0개 그룹은 스냅샷에서 제외.
  const { groups: updatePrunedGroups } = pruneEmptyGroups(body.groups, body.nodes);

  return finalizeOfficialSave(
    deps,
    {
      chainId,
      name: body.name,
      focusType: body.focusType,
      focusSecurityId,
      disclosureDate: body.disclosureDate ?? null,
      baseSnapshotId: body.baseSnapshotId,
      createdBy: actor.userId,
      groups: updatePrunedGroups,
      nodes: body.nodes,
      edges: body.edges,
      maxNodesPerChain: MAX_NODES_PER_CHAIN,
    },
    200,
  );
};

// findNodeDetailRowRepo는 route.ts에서 repository 팩토리 조립 시 재노출용으로 참조된다.
export { findNodeDetailRowRepo };
