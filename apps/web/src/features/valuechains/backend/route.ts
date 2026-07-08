import type { Context, Hono } from "hono";
import { todayInSeoul, isValidIsoDate, isWithinTimelineRange, type IsoDate } from "@iib/domain";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, getUser, type AppEnv } from "@/backend/hono/context";
import { findRoleByUserId } from "@/features/account/backend/repository";
import {
  valuechainListErrorCodes,
  valuechainsErrorCodes,
  type ValuechainListServiceError,
  type ValuechainsServiceError,
} from "@/features/valuechains/backend/error";
import {
  createValuechainsViewRepository,
  createChainMetricsRepository,
  createValuechainsCloneRepository,
  createValuechainsDeleteRepository,
  createValuechainsSaveRepository,
  createOfficialSaveRepository,
  findChainCards,
  findLatestEdgeIdentities,
  findNodeDetailRow,
  findSnapshotMarkers,
  findSnapshotStructureAt,
  findDailyMetricAt,
  findQuarterlyMetric,
} from "@/features/valuechains/backend/repository";
import { findExistingSecurityIds } from "@/features/securities/backend/repository";
import { createRelationTypeRepository } from "@/features/relation-types/backend/repository";
import {
  ChainCardListQuerySchema,
  ChainIdParamSchema,
  ChainTypeDispatchSchema,
  DailyMetricsQuerySchema,
  NodeDetailParamsSchema,
  QuarterlyMetricsQuerySchema,
  SaveChainRequestSchema,
  SaveOfficialChainRequestSchema,
  SnapshotAtQuerySchema,
} from "@/features/valuechains/backend/schema";
import {
  cloneOfficialChain,
  createOfficialChain,
  deleteUserChain,
  getChainView,
  getChainSnapshotAt,
  getChainTimelineMeta,
  getDailyMetrics,
  getLatestSnapshotForEdit,
  getNodeDetail,
  getQuarterlyMetrics,
  listMyChainCards,
  listOfficialChainCards,
  saveUserChain,
  updateOfficialChain,
} from "@/features/valuechains/backend/service";

/**
 * valuechains 라우터 (plan 모듈 B5, C-5) —
 * `GET /valuechains/official`, `GET /valuechains/mine`, `GET /valuechains/:chainId`.
 * HTTP 파싱/검증·의존성 주입·에러 로깅·respond() 위임만 담당한다(비즈니스 로직은 service.ts).
 * 목록 라우트(`official`/`mine`)는 동적 세그먼트(`:chainId`)보다 **먼저** 등록해야
 * Hono가 "official"/"mine"을 chainId로 오매칭하지 않는다.
 */
export const registerValuechainsRoutes = (app: Hono<AppEnv>) => {
  app.get("/valuechains/official", async (c) => {
    // 1. 쿼리 파라미터 Zod 검증 (spec 엣지 6)
    const parsed = ChainCardListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          valuechainListErrorCodes.invalidQuery,
          "페이지네이션 파라미터가 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    // 2. 의존성 획득 — 공개 API(인증 불필요)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = { findChainCards: (params: Parameters<typeof findChainCards>[1]) => findChainCards(supabase, params) };

    // 3. 서비스 호출
    const result = await listOfficialChainCards(repo, parsed.data);

    // 4. 에러 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainListServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/official] list failed", errorResult.error);
      }
    }

    // 5. 응답
    return respond(c, result);
  });

  app.get("/valuechains/mine", async (c) => {
    // 1. 인증 확인 (엣지 4·7 — 무인증/세션 만료 방어, 쿼리 검증보다 우선)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(
        c,
        failure(401, valuechainListErrorCodes.unauthorized, "로그인이 필요합니다."),
      );
    }

    // 2. 쿼리 파라미터 Zod 검증
    const parsed = ChainCardListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          valuechainListErrorCodes.invalidQuery,
          "페이지네이션 파라미터가 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    // 3. 의존성 획득
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = { findChainCards: (params: Parameters<typeof findChainCards>[1]) => findChainCards(supabase, params) };

    // 4. 서비스 호출
    const result = await listMyChainCards(repo, currentUser.id, parsed.data);

    // 5. 에러 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainListServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/mine] list failed", errorResult.error);
      }
    }

    // 6. 응답
    return respond(c, result);
  });

  app.get("/valuechains/:chainId", async (c) => {
    // 1. Path param 검증 (E12)
    const parsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!parsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.invalidChainId, "잘못된 밸류체인 경로입니다."),
      );
    }

    // 2. 의존성 획득 — 인증은 선택적(BR-6): 세션 있으면 사용자 식별, 없으면 Guest(null)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const repo = createValuechainsViewRepository(supabase);

    // 3. 서비스 호출
    const result = await getChainView(repo, parsed.data.chainId, currentUser?.id ?? null);

    // 4. 에러 로깅 (500류만 — 정합성 예외는 별도 식별 로그, E9 운영 추적)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        if (errorResult.error.code === valuechainsErrorCodes.snapshotMissing) {
          logger.error("[valuechains/get] snapshot missing (data integrity)", {
            chainId: parsed.data.chainId,
          });
        } else {
          logger.error("[valuechains/get] structure load failed", errorResult.error);
        }
      }
    }

    // 5. 응답
    return respond(c, result);
  });

  // ==========================================================================
  // UC-010: 밸류체인 대시보드 패널(일별/분기 지표) 조회
  // ==========================================================================

  app.get("/valuechains/:chainId/metrics/daily", async (c) => {
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidRequest, "잘못된 밸류체인 경로입니다."));
    }
    const queryParsed = DailyMetricsQuerySchema.safeParse(c.req.query());
    if (!queryParsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.invalidRequest, "요청 파라미터가 올바르지 않습니다.", queryParsed.error.format()),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const accessRepo = { findChainById: (chainId: string) => createValuechainsViewRepository(supabase).findChainById(chainId) };
    const metricsRepo = createChainMetricsRepository(supabase);
    const today = todayInSeoul(new Date());

    const result = await getDailyMetrics(
      { accessRepo, metricsRepo },
      { chainId: paramsParsed.data.chainId, currentUserId: currentUser?.id ?? null, query: queryParsed.data, today },
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/metrics/daily] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.get("/valuechains/:chainId/metrics/quarterly", async (c) => {
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidRequest, "잘못된 밸류체인 경로입니다."));
    }
    const queryParsed = QuarterlyMetricsQuerySchema.safeParse(c.req.query());
    if (!queryParsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.invalidRequest, "요청 파라미터가 올바르지 않습니다.", queryParsed.error.format()),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const accessRepo = { findChainById: (chainId: string) => createValuechainsViewRepository(supabase).findChainById(chainId) };
    const metricsRepo = createChainMetricsRepository(supabase);
    const today = todayInSeoul(new Date());

    const result = await getQuarterlyMetrics(
      { accessRepo, metricsRepo },
      { chainId: paramsParsed.data.chainId, currentUserId: currentUser?.id ?? null, query: queryParsed.data, today },
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/metrics/quarterly] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  // ==========================================================================
  // UC-011: 노드 클릭 상호작용(노드 상세 조회)
  // ==========================================================================

  app.get("/valuechains/:chainId/nodes/:nodeId", async (c) => {
    const parsed = NodeDetailParamsSchema.safeParse({
      chainId: c.req.param("chainId"),
      nodeId: c.req.param("nodeId"),
    });
    if (!parsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidParams, "잘못된 요청 경로입니다."));
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const repo = {
      findChainById: (chainId: string) => createValuechainsViewRepository(supabase).findChainById(chainId),
      findNodeDetailRow: (chainId: string, nodeId: string) => findNodeDetailRow(supabase, chainId, nodeId),
    };

    const result = await getNodeDetail(repo, parsed.data, currentUser?.id ?? null);

    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/nodes/get] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  // ==========================================================================
  // UC-012: 시점 타임라인 조회(타임라인 메타/스냅샷 복원)
  // ==========================================================================

  app.get("/valuechains/:chainId/timeline", async (c) => {
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidChainId, "잘못된 밸류체인 경로입니다."));
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const now = new Date();
    const deps = {
      accessRepo: { findChainById: (chainId: string) => createValuechainsViewRepository(supabase).findChainById(chainId) },
      findMarkers: (chainId: string) => findSnapshotMarkers(supabase, chainId),
    };

    const result = await getChainTimelineMeta(deps, paramsParsed.data.chainId, currentUser?.id ?? null, now);

    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/timeline] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.get("/valuechains/:chainId/snapshot-at", async (c) => {
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidChainId, "잘못된 밸류체인 경로입니다."));
    }

    const queryParsed = SnapshotAtQuerySchema.safeParse(c.req.query());
    const today = todayInSeoul(new Date());
    if (!queryParsed.success || !isValidIsoDate(queryParsed.data.date)) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidDate, "날짜 형식이 올바르지 않습니다."));
    }
    const date = queryParsed.data.date as IsoDate;
    if (!isWithinTimelineRange(date, today)) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.dateOutOfRange, "선택 가능한 날짜 범위를 벗어났습니다."),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const repo = {
      findChainById: (chainId: string) => createValuechainsViewRepository(supabase).findChainById(chainId),
      findSnapshotStructureAt: (chainId: string, asOfIso: string) =>
        findSnapshotStructureAt(supabase, chainId, asOfIso),
      findDailyMetricAt: (chainId: string, d: string) => findDailyMetricAt(supabase, chainId, d),
      findQuarterlyMetric: (chainId: string, year: number, quarter: number) =>
        findQuarterlyMetric(supabase, chainId, year, quarter),
    };

    const result = await getChainSnapshotAt(repo, paramsParsed.data.chainId, date, currentUser?.id ?? null);

    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/snapshot-at] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  // ==========================================================================
  // UC-016: 편집 대상 체인 최신 구성 조회(API-2 — 편집 캔버스 진입)
  // ==========================================================================

  app.get("/valuechains/:chainId/snapshots/latest", async (c) => {
    // 1. 인증 확인(E9)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, valuechainsErrorCodes.editUnauthorized, "로그인이 필요합니다."));
    }

    // 2. Path param 검증
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidChainId, "잘못된 밸류체인 경로입니다."));
    }

    // 3. 의존성 획득
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = createValuechainsViewRepository(supabase);
    const findActorRole = (userId: string) => findRoleByUserId(supabase, userId);

    // 4. 서비스 호출
    const result = await getLatestSnapshotForEdit(repo, findActorRole, paramsParsed.data.chainId, currentUser.id);

    // 5. 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/snapshots/latest] failed", errorResult.error);
      }
    }

    // 6. 응답
    return respond(c, result);
  });

  // ==========================================================================
  // UC-018/021: 밸류체인 저장(`POST /valuechains` 신규, `PUT /valuechains/:chainId` 갱신)
  // chainType 디스패치: POST는 body.chainType peek, PUT은 대상 체인의 DB chain_type으로 판별.
  // ==========================================================================

  const buildSaveDeps = (c: Context<AppEnv>) => {
    const supabase = getSupabase(c);
    return {
      saveRepo: createValuechainsSaveRepository(supabase),
      securitiesRepo: { findExistingSecurityIds: (ids: string[]) => findExistingSecurityIds(supabase, ids) },
      relationTypesRepo: {
        findAllRelationTypes: () => createRelationTypeRepository(supabase).findAllRelationTypes({ activeOnly: false }),
      },
    };
  };

  const buildOfficialSaveDeps = (c: Context<AppEnv>) => {
    const supabase = getSupabase(c);
    return {
      ...buildSaveDeps(c),
      officialSaveRepo: createOfficialSaveRepository(supabase),
      findPreviousEdgeIdentities: (chainId: string) => findLatestEdgeIdentities(supabase, chainId),
    };
  };

  app.post("/valuechains", async (c) => {
    // 1. 인증 확인(E9)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, valuechainsErrorCodes.saveAuthRequired, "로그인이 필요합니다."));
    }

    // 2. chainType 디스패치(peek) — 파싱 전 판별로 official 요청이 user 스키마의 unknown-key
    //    strip에 의해 필드 소실되는 것을 구조적으로 차단(R-2).
    const rawBody = await c.req.json().catch(() => ({}));
    const dispatchParsed = ChainTypeDispatchSchema.safeParse(rawBody);
    if (!dispatchParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.saveInvalidRequest, "chainType 값이 올바르지 않습니다."));
    }
    const chainType = dispatchParsed.data.chainType ?? "user";
    const logger = getLogger(c);

    if (chainType === "official") {
      const bodyParsed = SaveOfficialChainRequestSchema.safeParse(rawBody);
      if (!bodyParsed.success) {
        return respond(
          c,
          failure(400, valuechainsErrorCodes.saveInvalidRequest, "요청 본문 형식이 올바르지 않습니다.", bodyParsed.error.format()),
        );
      }
      const actorRole = await findRoleByUserId(getSupabase(c), currentUser.id);
      const result = await createOfficialChain(
        buildOfficialSaveDeps(c),
        { userId: currentUser.id, role: actorRole?.role ?? "user" },
        bodyParsed.data,
      );
      if (!result.ok) {
        const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
        if (result.status >= 500) {
          logger.error("[valuechains/save] official create failed", errorResult.error);
        }
      }
      return respond(c, result);
    }

    // 3. 본문 스키마 검증(E3)
    const bodyParsed = SaveChainRequestSchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.saveInvalidRequest, "요청 본문 형식이 올바르지 않습니다.", bodyParsed.error.format()),
      );
    }

    // 4. 서비스 호출
    const result = await saveUserChain(buildSaveDeps(c), {
      userId: currentUser.id,
      chainId: null,
      body: bodyParsed.data,
    });

    // 5. 에러 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/save] create failed", errorResult.error);
      }
    }

    // 6. 응답
    return respond(c, result);
  });

  app.put("/valuechains/:chainId", async (c) => {
    // 1. 인증 확인(E9)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, valuechainsErrorCodes.saveAuthRequired, "로그인이 필요합니다."));
    }

    // 2. Path param 검증
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.saveInvalidRequest, "잘못된 밸류체인 경로입니다."));
    }

    // 3. chainType 디스패치 — 대상 체인의 DB chain_type으로 판별(body의 chainType은 불신).
    const supabaseForDispatch = getSupabase(c);
    const targetMeta = await createValuechainsSaveRepository(supabaseForDispatch).findChainMetaById(
      paramsParsed.data.chainId,
    );
    const logger = getLogger(c);

    if (targetMeta && targetMeta.chain_type === "official") {
      const rawBody = await c.req.json().catch(() => ({}));
      const bodyParsed = SaveOfficialChainRequestSchema.safeParse(rawBody);
      if (!bodyParsed.success) {
        return respond(
          c,
          failure(400, valuechainsErrorCodes.saveInvalidRequest, "요청 본문 형식이 올바르지 않습니다.", bodyParsed.error.format()),
        );
      }
      const actorRole = await findRoleByUserId(supabaseForDispatch, currentUser.id);
      const result = await updateOfficialChain(
        buildOfficialSaveDeps(c),
        { userId: currentUser.id, role: actorRole?.role ?? "user" },
        paramsParsed.data.chainId,
        bodyParsed.data,
      );
      if (!result.ok) {
        const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
        if (result.status >= 500) {
          logger.error("[valuechains/save] official update failed", errorResult.error);
        }
      }
      return respond(c, result);
    }

    // 4. 본문 스키마 검증
    const rawBody = await c.req.json().catch(() => ({}));
    const bodyParsed = SaveChainRequestSchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.saveInvalidRequest, "요청 본문 형식이 올바르지 않습니다.", bodyParsed.error.format()),
      );
    }

    // 5. 서비스 호출
    const result = await saveUserChain(buildSaveDeps(c), {
      userId: currentUser.id,
      chainId: paramsParsed.data.chainId,
      body: bodyParsed.data,
    });

    // 6. 에러 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/save] update failed", errorResult.error);
      }
    }

    // 7. 응답
    return respond(c, result);
  });

  // ==========================================================================
  // UC-014: 공식 체인 복제
  // ==========================================================================

  app.post("/valuechains/:chainId/clone", async (c) => {
    // 1. 인증 확인(spec Edge 1·9)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, valuechainsErrorCodes.unauthorized, "로그인이 필요합니다."));
    }

    // 2. Path param 검증(400 INVALID_PARAMS)
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.invalidParams, "잘못된 밸류체인 경로입니다."));
    }

    // 3. 의존성 획득 — Request Body 없음(spec §6.2)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = createValuechainsCloneRepository(supabase);

    // 4. 서비스 호출
    const result = await cloneOfficialChain(repo, currentUser.id, paramsParsed.data.chainId);

    // 5. 에러 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/clone] failed", errorResult.error);
      }
    }

    // 6. 응답
    return respond(c, result);
  });

  // ==========================================================================
  // UC-019: 사용자 체인 삭제
  // ==========================================================================

  app.delete("/valuechains/:chainId", async (c) => {
    // 1. 인증 확인(E6)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, valuechainsErrorCodes.unauthorized, "로그인이 필요합니다."));
    }

    // 2. Path param 검증(E9)
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, valuechainsErrorCodes.validationError, "잘못된 밸류체인 경로입니다."));
    }

    // 3. 의존성 획득 — Request Body 없음(spec §6.2)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = createValuechainsDeleteRepository(supabase);

    // 4. 서비스 호출
    const result = await deleteUserChain(repo, currentUser.id, paramsParsed.data.chainId);

    // 5. 에러 로깅(500=error, 403=warn)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[valuechains/delete] failed", errorResult.error);
      } else if (result.status === 403) {
        logger.warn("[valuechains/delete] forbidden", errorResult.error);
      }
    }

    // 6. 성공(204)은 무본문 응답 — 공통 respond()는 JSON 직렬화를 전제하므로 이 경로만 직접 반환한다.
    if (result.ok) {
      return c.body(null, 204);
    }
    return respond(c, result);
  });
};
