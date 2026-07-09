/**
 * 워커 리포지토리 공용 결과 타입 (docs/techstack.md §4 — 웹 repository.ts 컨벤션과 동일 원칙).
 * 모든 리포지토리 함수는 throw 대신 discriminated union을 반환한다.
 */
export type RepoResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function repoOk<T>(data: T): RepoResult<T> {
  return { ok: true, data };
}

export function repoFail<T>(error: string): RepoResult<T> {
  return { ok: false, error };
}

/** Supabase 단일 select는 기본 최대 1,000행만 반환한다. .range() 페이지네이션으로 전량을 모은다. */
export const SUPABASE_PAGE_SIZE = 1000;

/**
 * 마지막 빌더가 .range(from,to) 를 지원하는 Supabase 쿼리를 페이지네이션으로 전량 수집한다.
 * buildQuery()는 매 페이지마다 새 쿼리를 만든다(Supabase 쿼리는 1회용).
 */
export async function fetchAllPages<TRow>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: TRow[] | null; error: { message: string } | null }>;
  },
): Promise<RepoResult<TRow[]>> {
  const all: TRow[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error || !data) {
      return repoFail(error?.message ?? "no data returned");
    }
    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break; // 마지막 페이지
  }
  return repoOk(all);
}
