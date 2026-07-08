/**
 * carry-forward 리졸버 (docs/usecases/029/plan.md 모듈 2).
 * 정렬된 관측 시계열에서 "일자 이하 마지막 관측값"을 찾는 제네릭 순수 함수(database.md §4.5 패턴).
 * 종가·환율 공용 — I/O·Date.now() 호출 없음(순수).
 */
import type { IsoDate } from "../types/common";

export interface CarryForwardObservation<T> {
  readonly date: IsoDate;
  readonly value: T;
}

export interface CarryForwardResolution<T> {
  readonly value: T;
  readonly observedDate: IsoDate;
  readonly isCarried: boolean;
}

export interface CarryForwardResolver<T> {
  /** `date` 이하 마지막 관측값. 관측값이 전혀 없으면 `null`(합산 제외 신호). */
  resolve(date: IsoDate): CarryForwardResolution<T> | null;
}

/**
 * `observations`는 `date` 오름차순 정렬 입력을 전제한다(리포지토리가 정렬 보장).
 * `seed`는 범위 시작 이전 마지막 관측값(carry-forward 시드 RPC 결과) — 관측값이 비어 있어도
 * seed가 있으면 전 구간에 이월된다.
 * 같은 리졸버에 일자 오름차순으로 반복 호출하면 내부 커서로 O(n+m) 성능을 보장한다.
 */
export function createCarryForwardResolver<T>(
  observations: ReadonlyArray<CarryForwardObservation<T>>,
  seed?: CarryForwardObservation<T> | null,
): CarryForwardResolver<T> {
  let cursor = 0;
  let lastQueriedDate: IsoDate | null = null;

  return {
    resolve(date: IsoDate): CarryForwardResolution<T> | null {
      // 커서 최적화는 오름차순 호출을 전제 — 역행 호출 시 처음부터 재탐색해 정확성을 보장한다.
      if (lastQueriedDate !== null && date < lastQueriedDate) {
        cursor = 0;
      }
      lastQueriedDate = date;

      while (cursor < observations.length && observations[cursor]!.date <= date) {
        cursor += 1;
      }

      if (cursor === 0) {
        // 관측 구간 진입 전 — seed(범위 시작 이전 마지막 값)로만 이월 가능.
        if (seed === null || seed === undefined) return null;
        return { value: seed.value, observedDate: seed.date, isCarried: seed.date < date };
      }

      const observation = observations[cursor - 1]!;
      return {
        value: observation.value,
        observedDate: observation.date,
        isCarried: observation.date < date,
      };
    },
  };
}
