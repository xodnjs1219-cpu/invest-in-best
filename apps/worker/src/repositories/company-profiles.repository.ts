/**
 * 기업정보 리포지토리 (docs/usecases/027/plan.md 모듈 12).
 * company_profiles UPSERT(+last_collected_at), 증분 갱신 대상 판정 조회(OQ-1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface CompanyProfileRow {
  securityId: string;
  representativeName: string | null;
  establishedDate: string | null;
  homepageUrl: string | null;
  sector: string | null;
  industryCode: string | null;
  address: string | null;
  phone: string | null;
}

export async function upsertProfiles(
  client: SupabaseClient,
  rows: CompanyProfileRow[],
): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  const nowIso = new Date().toISOString();
  const { error } = await client.from("company_profiles").upsert(
    rows.map((row) => ({
      security_id: row.securityId,
      representative_name: row.representativeName,
      established_date: row.establishedDate,
      homepage_url: row.homepageUrl,
      sector: row.sector,
      industry_code: row.industryCode,
      address: row.address,
      phone: row.phone,
      last_collected_at: nowIso,
    })),
  );

  if (error) {
    return repoFail(`upsertProfiles failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export interface ProfileFreshness {
  securityId: string;
  lastCollectedAt: string | null;
}

export async function findProfileFreshness(
  client: SupabaseClient,
  securityIds: string[],
): Promise<RepoResult<ProfileFreshness[]>> {
  const { data, error } = await client
    .from("company_profiles")
    .select("security_id, last_collected_at")
    .in("security_id", securityIds);

  if (error || !data) {
    return repoFail(`findProfileFreshness failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ security_id: string; last_collected_at: string | null }>).map((row) => ({
      securityId: row.security_id,
      lastCollectedAt: row.last_collected_at,
    })),
  );
}
