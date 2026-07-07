import cron from "node-cron";

/**
 * 워커 진입점 (techstack.md §4, §8).
 * 실제 배치 Job 등록(collect-quotes 등)은 이후 구현 단계에서 jobs/*.job.ts로 추가된다.
 * 지금은 환경 구축 단계이므로 스케줄러가 기동되는지만 확인할 수 있는 최소 placeholder만 둔다.
 */
export function startScheduler(): void {
  // 매 정시 실행되는 placeholder cron 등록 예시. 실제 Job은 구현 단계에서 교체한다.
  cron.schedule("0 * * * *", () => {
    console.log("[scheduler] hourly tick placeholder");
  });
  console.log("[scheduler] worker started");
}

if (process.env.NODE_ENV !== "test") {
  startScheduler();
}
