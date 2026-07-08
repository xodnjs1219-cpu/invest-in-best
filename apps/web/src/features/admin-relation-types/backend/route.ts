import type { Context, Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { withAdminAuth } from "@/backend/middleware/admin";
import {
  adminRelationTypeErrorCodes,
  type AdminRelationTypeServiceError,
} from "@/features/admin-relation-types/backend/error";
import {
  findRelationTypeById,
  findRelationTypeByName,
  insertRelationType,
  listRelationTypesWithUsage,
  updateRelationType as updateRelationTypeRepo,
} from "@/features/admin-relation-types/backend/repository";
import {
  RelationTypeCreateRequestSchema,
  RelationTypeIdParamSchema,
  RelationTypeUpdateRequestSchema,
} from "@/features/admin-relation-types/backend/schema";
import {
  createRelationType,
  listRelationTypes,
  updateRelationType,
  type AdminRelationTypeRepositoryDeps,
} from "@/features/admin-relation-types/backend/service";

const ADMIN_RELATION_TYPES_BASE_PATH = "/admin/relation-types";

/** 409는 정상적인 비즈니스 분기이므로 info 레벨, 404는 info, 그 외(500)는 error 레벨로 로깅한다. */
const INFO_LEVEL_CODES: AdminRelationTypeServiceError[] = [
  adminRelationTypeErrorCodes.validationError,
  adminRelationTypeErrorCodes.notFound,
  adminRelationTypeErrorCodes.nameDuplicate,
];

export const registerAdminRelationTypeRoutes = (app: Hono<AppEnv>) => {
  // 그룹 미들웨어 — 이 경로 이하 전체(405 스텁 포함)에 Admin 인증을 선적용한다(BR-6).
  app.use(`${ADMIN_RELATION_TYPES_BASE_PATH}/*`, withAdminAuth());

  const buildDeps = (c: Context<AppEnv>): AdminRelationTypeRepositoryDeps => {
    const supabase = getSupabase(c);
    return {
      listRelationTypesWithUsage: () => listRelationTypesWithUsage(supabase),
      findRelationTypeById: (id) => findRelationTypeById(supabase, id),
      findRelationTypeByName: (normalizedName, excludeId) =>
        findRelationTypeByName(supabase, normalizedName, excludeId),
      insertRelationType: (params) => insertRelationType(supabase, params),
      updateRelationType: (id, patch) => updateRelationTypeRepo(supabase, id, patch),
    };
  };

  app.get(ADMIN_RELATION_TYPES_BASE_PATH, async (c) => {
    const logger = getLogger(c);
    const result = await listRelationTypes(buildDeps(c));
    logResult(logger, "[admin-relation-types/list]", result);
    return respond(c, result);
  });

  app.post(ADMIN_RELATION_TYPES_BASE_PATH, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const bodyParsed = RelationTypeCreateRequestSchema.safeParse(body);
    if (!bodyParsed.success) {
      return respond(
        c,
        failure(
          400,
          adminRelationTypeErrorCodes.validationError,
          "요청 본문 형식이 올바르지 않습니다.",
          bodyParsed.error.format(),
        ),
      );
    }

    const logger = getLogger(c);
    const result = await createRelationType(buildDeps(c), bodyParsed.data);
    logResult(logger, "[admin-relation-types/create]", result);
    return respond(c, result);
  });

  app.patch(`${ADMIN_RELATION_TYPES_BASE_PATH}/:id`, async (c) => {
    const idParsed = RelationTypeIdParamSchema.safeParse(c.req.param("id"));
    if (!idParsed.success) {
      return respond(
        c,
        failure(400, adminRelationTypeErrorCodes.validationError, "id 형식이 올바르지 않습니다."),
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const bodyParsed = RelationTypeUpdateRequestSchema.safeParse(body);
    if (!bodyParsed.success) {
      return respond(
        c,
        failure(
          400,
          adminRelationTypeErrorCodes.validationError,
          "요청 본문 형식이 올바르지 않습니다.",
          bodyParsed.error.format(),
        ),
      );
    }

    const logger = getLogger(c);
    const result = await updateRelationType(buildDeps(c), idParsed.data, bodyParsed.data);
    logResult(logger, "[admin-relation-types/update]", result);
    return respond(c, result);
  });

  // 물리 삭제 미제공(R-3, BR-1) — 서비스/리포지토리 호출 없이 405 스텁만 반환한다.
  app.delete(`${ADMIN_RELATION_TYPES_BASE_PATH}/:id`, async (c) => {
    const logger = getLogger(c);
    logger.warn("[admin-relation-types/delete] blocked physical delete attempt", {
      id: c.req.param("id"),
    });
    return respond(
      c,
      failure(
        405,
        adminRelationTypeErrorCodes.methodNotAllowed,
        "관계 종류는 삭제할 수 없습니다. 비활성화를 사용하세요.",
      ),
    );
  });
};

type LoggableResult = { ok: boolean } & Record<string, unknown>;

const logResult = (
  logger: ReturnType<typeof getLogger>,
  scope: string,
  result: LoggableResult,
) => {
  if (result.ok) {
    return;
  }
  const errorResult = result as ErrorResult<AdminRelationTypeServiceError, unknown>;
  const isInfoLevel = INFO_LEVEL_CODES.includes(errorResult.error.code);
  if (isInfoLevel) {
    logger.info(`${scope} request rejected`, errorResult.error);
  } else {
    logger.error(`${scope} failed`, errorResult.error);
  }
};
