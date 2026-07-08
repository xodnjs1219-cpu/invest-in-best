import {
  DATA_SOURCE_LABELS,
  FRESHNESS_JOBS,
  dateToCalendarQuarter,
  resolveDailyMetricsRange,
  resolveQuarterlyMetricsRange,
  toSeoulDayEndIso,
  todayInSeoul,
  TIMESERIES_MIN_START_DATE,
  validateEdgesPayload,
  type EdgeSaveViolation,
  type NodeIdentity,
  type PreviousEdgeIdentity,
  type SaveEdgePayload,
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
  findNodeDetailRow as findNodeDetailRowRepo,
  findSnapshotMarkers,
  findSnapshotStructureAt,
  findDailyMetricAt,
  findQuarterlyMetric as findQuarterlyMetricRepo,
  type ValuechainsViewRepository,
  type ChainMetricsRepository,
} from "@/features/valuechains/backend/repository";
import {
  BatchRunFreshnessRowSchema,
  ChainCardListResponseSchema,
  ChainCardRpcRowSchema,
  ChainSnapshotRowSchema,
  ChainViewResponseSchema,
  DailyAnnotationsRowSchema,
  DailyMetricRowSchema,
  DailyMetricsResponseSchema,
  LatestSnapshotResponseSchema,
  NodeDetailRowSchema,
  NodeDetailResponseSchema,
  QuarterlyMetricRowSchema,
  QuarterlyMetricsResponseSchema,
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
  type DailyMetricsQuery,
  type DailyMetricsResponse,
  type LatestSnapshotResponse,
  type NodeDetailResponse,
  type QuarterlyMetricsQuery,
  type QuarterlyMetricsResponse,
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

// findNodeDetailRowRepo는 route.ts에서 repository 팩토리 조립 시 재노출용으로 참조된다.
export { findNodeDetailRowRepo };
