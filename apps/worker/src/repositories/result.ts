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
