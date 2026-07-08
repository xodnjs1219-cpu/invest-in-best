import type { SupabaseClient } from "@supabase/supabase-js";

const VALUE_CHAINS_TABLE = "value_chains";
const ADMIN_LIST_OFFICIAL_CHAINS_RPC = "admin_list_official_chains";

export type RepositoryReadResult<T> = { ok: true; rows: T } | { ok: false; message: string };
export type RepositorySingleResult<T> = { ok: true; row: T } | { ok: false; message: string };

export type OfficialChainMetaRow = { id: string; chain_type: "official" | "user"; is_archived: boolean };

/** service는 이 인터페이스에만 의존한다(어드민 목록/보관 전용). */
export interface AdminValuechainsRepository {
  listOfficialChains(): Promise<RepositoryReadResult<unknown[]>>;
  findOfficialChainById(chainId: string): Promise<RepositorySingleResult<OfficialChainMetaRow | null>>;
  archiveOfficialChainById(chainId: string): Promise<{ ok: true } | { ok: false; message: string }>;
}

/** `admin_list_official_chains()` RPC 호출 캡슐화(R-9 — 복잡 조인은 SQL 함수 소관). */
export const listOfficialChains = async (client: SupabaseClient): Promise<RepositoryReadResult<unknown[]>> => {
  const { data, error } = await client.rpc(ADMIN_LIST_OFFICIAL_CHAINS_RPC);
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: data ?? [] };
};

/** 보관 대상 존재·유형 확인(R-7 — user 체인은 대상 아님). */
export const findOfficialChainById = async (
  client: SupabaseClient,
  chainId: string,
): Promise<RepositorySingleResult<OfficialChainMetaRow | null>> => {
  const { data, error } = await client
    .from(VALUE_CHAINS_TABLE)
    .select("id, chain_type, is_archived")
    .eq("id", chainId)
    .maybeSingle<OfficialChainMetaRow>();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data ?? null };
};

/**
 * 보관 처리 — 조건 이중화(`id` + `chain_type='official'`)로 user 체인 오보관을 원천 차단한다(R-7).
 * 영향 행 0건이어도 오류 아님(판정은 service — 이미 보관 상태의 멱등 처리, E8).
 */
export const archiveOfficialChainById = async (
  client: SupabaseClient,
  chainId: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { error } = await client
    .from(VALUE_CHAINS_TABLE)
    .update({ is_archived: true })
    .eq("id", chainId)
    .eq("chain_type", "official");

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
};

export const createAdminValuechainsRepository = (client: SupabaseClient): AdminValuechainsRepository => ({
  listOfficialChains: () => listOfficialChains(client),
  findOfficialChainById: (chainId) => findOfficialChainById(client, chainId),
  archiveOfficialChainById: (chainId) => archiveOfficialChainById(client, chainId),
});
