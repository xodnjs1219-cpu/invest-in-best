import { failure, success, type HandlerResult } from "@/backend/http/response";
import { adminChainErrorCodes, type AdminChainServiceError } from "@/features/admin-valuechains/backend/error";
import type { AdminValuechainsRepository } from "@/features/admin-valuechains/backend/repository";
import {
  AdminChainListRpcRowSchema,
  ArchiveChainResponseSchema,
  type AdminChainListResponse,
  type ArchiveChainResponse,
} from "@/features/admin-valuechains/backend/schema";

/**
 * 어드민 공식 체인 목록 조회(UC-021 spec API-1, plan 모듈 M11).
 * RPC 오류·행 스키마 위반은 모두 500으로 매핑한다. 빈 목록도 정상 200(시드 이전 상태 허용, E5).
 * `includeArchived=false`면 보관 행을 서비스 레벨에서 제외한다(RPC는 항상 전체 반환).
 */
export const listAdminChains = async (
  repo: AdminValuechainsRepository,
  query: { includeArchived: boolean },
): Promise<HandlerResult<AdminChainListResponse, AdminChainServiceError, unknown>> => {
  const readResult = await repo.listOfficialChains();
  if (!readResult.ok) {
    return failure(500, adminChainErrorCodes.listFailed, readResult.message);
  }

  const chains: AdminChainListResponse["chains"] = [];
  for (const rawRow of readResult.rows) {
    const rowCheck = AdminChainListRpcRowSchema.safeParse(rawRow);
    if (!rowCheck.success) {
      return failure(
        500,
        adminChainErrorCodes.listFailed,
        "공식 체인 목록 데이터 형식이 올바르지 않습니다.",
        rowCheck.error.format(),
      );
    }
    const row = rowCheck.data;
    if (!query.includeArchived && row.is_archived) {
      continue;
    }

    chains.push({
      chainId: row.chain_id,
      name: row.name,
      focusType: row.focus_type,
      focusSecurityId: row.focus_security_id,
      isArchived: row.is_archived,
      latestSnapshot:
        row.latest_snapshot_id && row.latest_effective_at && row.latest_change_source
          ? {
              snapshotId: row.latest_snapshot_id,
              effectiveAt: row.latest_effective_at,
              changeSource: row.latest_change_source,
              nodeCount: row.node_count,
            }
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return success({ chains });
};

/**
 * 공식 체인 삭제(보관, UC-021 spec API-5, plan 모듈 M11).
 * 미존재/user 체인 → 404(R-7 — 존재 비노출이 아니라 대상 자체가 아니므로). 이미 보관 → 멱등 200(E8).
 * 물리 삭제 경로 없음(BR-4 — repository에 delete 함수 자체가 없다).
 */
export const archiveChain = async (
  repo: AdminValuechainsRepository,
  chainId: string,
): Promise<HandlerResult<ArchiveChainResponse, AdminChainServiceError, unknown>> => {
  const findResult = await repo.findOfficialChainById(chainId);
  if (!findResult.ok) {
    return failure(500, adminChainErrorCodes.archiveFailed, findResult.message);
  }
  if (!findResult.row || findResult.row.chain_type !== "official") {
    return failure(404, adminChainErrorCodes.chainNotFound, "공식 체인을 찾을 수 없습니다.");
  }

  if (findResult.row.is_archived) {
    const dto = { chainId, isArchived: true as const };
    const parsed = ArchiveChainResponseSchema.safeParse(dto);
    return success(parsed.success ? parsed.data : dto, 200);
  }

  const archiveResult = await repo.archiveOfficialChainById(chainId);
  if (!archiveResult.ok) {
    return failure(500, adminChainErrorCodes.archiveFailed, archiveResult.message);
  }

  const dto = { chainId, isArchived: true as const };
  const parsed = ArchiveChainResponseSchema.safeParse(dto);
  if (!parsed.success) {
    return failure(500, adminChainErrorCodes.archiveFailed, "응답 데이터 형식이 올바르지 않습니다.", parsed.error.format());
  }

  return success(parsed.data, 200);
};
