/**
 * 잡 중복 기동 방지 (docs/usecases/026/plan.md 모듈 6).
 * 워커는 단일 프로세스(techstack §8)이므로 프로세스 내 인메모리 락으로 충분하다.
 * 프로세스 재기동·크래시 케이스는 멱등 적재가 2차 방어한다 (spec 6.2(1)·E8·E12).
 * release는 호출부 finally에서 보장 호출할 것.
 */
export interface JobLock {
  tryAcquire(jobType: string): boolean;
  release(jobType: string): void;
}

export function createJobLock(): JobLock {
  const running = new Set<string>();

  return {
    tryAcquire(jobType: string): boolean {
      if (running.has(jobType)) return false;
      running.add(jobType);
      return true;
    },
    release(jobType: string): void {
      running.delete(jobType);
    },
  };
}
