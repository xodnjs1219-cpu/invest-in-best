/**
 * 기업정보 리포지토리 (docs/usecases/027/plan.md 모듈 12).
 * company_profiles UPSERT(+last_collected_at), 증분 갱신 대상 판정 조회(OQ-1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages, repoFail, repoOk, type RepoResult } from "./result";

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
  // KRX 대상 종목 전체(1,000 초과 가능)를 조회 — 잘리면 미조회 종목이 항상 갱신 대상으로 오판되어
  // DART 재호출을 낭비한다. 페이지네이션으로 전량 수집. security_id로 안정 정렬.
  const paged = await fetchAllPages<{ security_id: string; last_collected_at: string | null }>(() =>
    client
      .from("company_profiles")
      .select("security_id, last_collected_at")
      .in("security_id", securityIds)
      .order("security_id", { ascending: true }),
  );
  if (!paged.ok) {
    return repoFail(`findProfileFreshness failed: ${paged.error}`);
  }
  return repoOk(
    paged.data.map((row) => ({
      securityId: row.security_id,
      lastCollectedAt: row.last_collected_at,
    })),
  );
}
