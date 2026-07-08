/**
 * LLM 어댑터 계약 (docs/usecases/030/plan.md 모듈 4).
 * 잡이 의존하는 유일한 LLM 표면(BR-13) — 공급자 교체 시 잡 로직은 변경되지 않는다.
 */
import type { LlmProposalCandidate } from "@iib/domain";
import type { WorkerConfig } from "../../runtime/config";
import type { RateLimiter } from "../../runtime/rate-limiter";

export type LlmNodeKind = "listed_company" | "free_subject";

export interface LlmChainContextNode {
  nodeId: string;
  displayName: string;
  nodeKind: LlmNodeKind;
}

export interface LlmChainContextEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeName: string;
}

export interface LlmActiveRelationType {
  relationTypeId: string;
  name: string;
  isDirected: boolean;
}

export interface LlmChainContext {
  chainName: string;
  nodes: LlmChainContextNode[];
  edges: LlmChainContextEdge[];
  activeRelationTypes: LlmActiveRelationType[];
}

export interface LlmDisclosureInput {
  title: string;
  disclosureDate: string;
  companyName: string;
  ticker: string;
  market: string;
  url: string | null;
  /** 원문 발췌(R-3) — fetch 실패/미확보 시 null(메타데이터-온리 폴백). */
  contentExcerpt: string | null;
}

export interface LlmAnalysisInput {
  disclosure: LlmDisclosureInput;
  chainContext: LlmChainContext;
}

export interface LlmAnalysisOutcome {
  /** 별칭 역매핑 완료·항목 Zod 통과분만(R-7·R-12). 관련 변경 없음 판단 시 빈 배열. */
  proposals: LlmProposalCandidate[];
  /** 항목 레벨 스키마 위반으로 드롭된 개수(R-7 — 환각 방어 지표). */
  droppedItemCount: number;
}

/**
 * LLM 포트 — 공시 1건 × 체인 1건 = 호출 1건(E10·H-4).
 */
export interface LlmPort {
  analyzeDisclosure(input: LlmAnalysisInput): Promise<LlmAnalysisOutcome>;
}

/** LLM 자격 정보 누락/무효(401/403) — 잡 수준 실패 신호(E14). */
export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export type LlmRequestErrorKind = "timeout" | "rate_limited" | "server_error" | "invalid_response";

/** 어댑터 내부 재시도 소진 후의 최종 실패 — 공시 단위 격리 신호(E4·E7). */
export class LlmRequestError extends Error {
  readonly kind: LlmRequestErrorKind;
  readonly retryAfterMs?: number;

  constructor(kind: LlmRequestErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "LlmRequestError";
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface LlmClientFactoryOptions {
  config: WorkerConfig;
  rateLimiter: RateLimiter;
}

/** 팩토리는 생성 시 키 검증(부재 시 LlmConfigError throw) — 잡은 run() 내부에서 팩토리를 호출한다(E14). */
export type LlmClientFactory = (options: LlmClientFactoryOptions) => LlmPort;
