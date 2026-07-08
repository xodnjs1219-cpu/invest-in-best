/**
 * 백필 체크포인트 플랜 (docs/usecases/031/plan.md 모듈 13).
 * 순수 로직 — checkpoint_key 체계, cursor Zod 스키마, 진행률 계산.
 * 커서 파손 시 검증 실패를 "신규 단위"로 안전 강등한다(크래시 없이 처음부터 재개).
 */
import { z } from "zod";

/** Phase 1(과거 일봉 백필) — 종목 단위 체크포인트 키(spec 5 — 일봉은 종목 단위). */
export function candlesCheckpointKey(securityId: string): string {
  return `phase1:candles:${securityId}`;
}

const phase1CursorSchema = z.object({
  before: z.string().nullable(),
});

export type Phase1Cursor = z.infer<typeof phase1CursorSchema>;

/** 신규 종목(체크포인트 미존재)의 초기 커서 — 최신 페이지부터 소급 시작. */
export function phase1InitialCursor(): Phase1Cursor {
  return { before: null };
}

/** 저장된 cursor(jsonb)를 검증한다. 스키마 불일치는 초기 커서로 강등(재개 안전성, BR-6). */
export function parsePhase1Cursor(raw: unknown): Phase1Cursor {
  const parsed = phase1CursorSchema.safeParse(raw);
  if (!parsed.success) {
    return phase1InitialCursor();
  }
  return parsed.data;
}

/** phase0:seed — 종목 마스터 시드·보강 단일 체크포인트 키. */
export const PHASE0_SEED_CHECKPOINT_KEY = "phase0:seed";

const phase0StepSchema = z.enum(["dart", "sec", "toss"]);
export type Phase0Step = z.infer<typeof phase0StepSchema>;

const phase0CursorSchema = z.object({
  step: phase0StepSchema,
  tossChunkIndex: z.number().int().nonnegative(),
});

export type Phase0Cursor = z.infer<typeof phase0CursorSchema>;

export function phase0InitialCursor(): Phase0Cursor {
  return { step: "dart", tossChunkIndex: 0 };
}

export function parsePhase0Cursor(raw: unknown): Phase0Cursor {
  const parsed = phase0CursorSchema.safeParse(raw);
  if (!parsed.success) {
    return phase0InitialCursor();
  }
  return parsed.data;
}

export interface ProgressCounts {
  completed: number;
  total: number;
}

/** 완료/전체 비율(UC-023 조회는 DB 직접 조회가 SOT지만, 종료 로그 요약에도 사용). total=0이면 완료로 간주(1). */
export function computeProgress(counts: ProgressCounts): number {
  if (counts.total === 0) return 1;
  return counts.completed / counts.total;
}
