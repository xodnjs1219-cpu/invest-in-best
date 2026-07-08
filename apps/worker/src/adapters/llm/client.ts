/**
 * LLM 어댑터 구현 (docs/usecases/030/plan.md 모듈 6) 【외부 서비스 연동 모듈 — Anthropic Claude API】
 *
 * 공급자 확정(R-1 게이트): Anthropic Claude (`@anthropic-ai/sdk`).
 * 근거: (1) tool_choice로 특정 tool 호출을 강제할 수 있어 구조화 출력(JSON) 강제(BR-14)를
 *       API 레벨에서 가장 직접적으로 보장한다(OpenAI의 json_schema response_format 대비 강제성이
 *       tool_choice.type="tool"로 더 명확히 고정됨). (2) 이 프로젝트의 개발 환경(Claude Code)과
 *       생태계 정합성. (3) techstack §10 후보 SDK 버전(0.110.0) 중 먼저 확정.
 *
 * 구조화 출력 강제: `tools`에 단일 tool(`propose_relation_changes`, JSON Schema = dto.ts의 Zod 스키마와
 * 동기)을 등록하고 `tool_choice: { type: "tool", name: "propose_relation_changes" }`로 강제 호출한다.
 * 응답의 tool_use 블록 input을 llmEnvelopeSchema로 검증한다(BR-14 — 자유 텍스트를 직접 신뢰하지 않음).
 */
import Anthropic from "@anthropic-ai/sdk";
import { LLM_REQUEST_TIMEOUT_MS, LLM_PROPOSAL_TYPES } from "@iib/domain";
import type { WorkerConfig } from "../../runtime/config";
import type { RateLimiter } from "../../runtime/rate-limiter";
import { withRetry, type RetryOptions } from "../../runtime/retry";
import {
  LlmConfigError,
  LlmRequestError,
  type LlmAnalysisInput,
  type LlmAnalysisOutcome,
  type LlmPort,
} from "./contract";
import { llmEnvelopeSchema, mapItemsToCandidates } from "./dto";
import { buildAliasMaps, buildAnalysisPrompt } from "./prompt";

/** Anthropic 모델명 — 공급자 종속 상수라 domain이 아닌 어댑터 내부에 위치(UC-026 TPS 상수와 동일 원칙).
 * claude-sonnet-5: near-Opus 품질을 Sonnet 비용으로 제공 — 대량 공시 분석 배치에 적합.
 * tool_choice 강제({type:"tool"})와 structured output을 지원하므로 아래 강제 호출 방식 유효. */
const ANTHROPIC_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 4_096;

const PROPOSE_TOOL_NAME = "propose_relation_changes";

/** dto.ts의 Zod 스키마와 필드 동기 — 이중 정의 드리프트 방지(변경 시 dto.ts도 함께 갱신할 것). */
const PROPOSE_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          proposalType: { type: "string", enum: [...LLM_PROPOSAL_TYPES] },
          sourceNodeAlias: { type: "string" },
          targetNodeAlias: { type: "string" },
          relationTypeAlias: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["proposalType", "sourceNodeAlias", "targetNodeAlias", "relationTypeAlias", "rationale"],
      },
    },
  },
  required: ["proposals"],
};

export interface LlmClientClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: LlmClientClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface CreateLlmClientOptions {
  config: WorkerConfig;
  rateLimiter: RateLimiter;
  clock?: LlmClientClock;
  retryOptions?: Partial<RetryOptions>;
  /** 테스트 주입용 — 미지정 시 config.anthropicApiKey로 실 SDK 클라이언트를 생성한다. */
  anthropicClient?: Pick<Anthropic, "messages">;
}

/** 봉투(tool_use 부재/형식 위반) 파싱 실패 — 재시도 대상(R-7). */
class LlmEnvelopeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmEnvelopeParseError";
  }
}

function hasStatus(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status: unknown }).status === "number";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === "APIConnectionTimeoutError") return true;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return true;
  return false;
}

/** 401/403 = 자격 정보 문제(즉시 LlmConfigError). 429/5xx/타임아웃/봉투파싱실패 = 재시도 대상. */
function shouldRetryLlmError(error: unknown): boolean {
  if (error instanceof LlmEnvelopeParseError) return true;
  if (isTimeoutError(error)) return true;
  if (hasStatus(error)) {
    if (error.status === 401 || error.status === 403) return false;
    if (error.status === 429) return true;
    if (error.status >= 500) return true;
    return false;
  }
  return true; // 네트워크 오류 등
}

function classifyFinalError(error: unknown): LlmConfigError | LlmRequestError {
  if (hasStatus(error) && (error.status === 401 || error.status === 403)) {
    return new LlmConfigError(`Anthropic 인증 실패(status=${error.status}) — API 키를 점검하세요: ${errorMessage(error)}`);
  }
  if (isTimeoutError(error)) {
    return new LlmRequestError("timeout", `LLM 요청 타임아웃: ${errorMessage(error)}`);
  }
  if (hasStatus(error) && error.status === 429) {
    const retryAfterMs = extractRetryAfterMsFromError(error);
    return new LlmRequestError("rate_limited", `LLM 레이트리밋 소진: ${errorMessage(error)}`, retryAfterMs);
  }
  if (hasStatus(error) && error.status >= 500) {
    return new LlmRequestError("server_error", `LLM 서버 오류(status=${error.status}): ${errorMessage(error)}`);
  }
  if (error instanceof LlmEnvelopeParseError) {
    return new LlmRequestError("invalid_response", `LLM 응답 검증 실패: ${error.message}`);
  }
  return new LlmRequestError("server_error", `LLM 요청 실패: ${errorMessage(error)}`);
}

function extractRetryAfterMsFromError(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "headers" in error &&
    error.headers instanceof Headers
  ) {
    const retryAfter = error.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
    }
  }
  return undefined;
}

/**
 * 팩토리 — 생성 시 키 검증(부재 시 LlmConfigError throw, E14). 잡은 run() 내부에서 이 팩토리를 호출한다.
 */
export function createLlmClient(options: CreateLlmClientOptions): LlmPort {
  const { config, rateLimiter } = options;
  const clock = options.clock ?? defaultClock;

  if (!config.anthropicApiKey) {
    throw new LlmConfigError("ANTHROPIC_API_KEY가 설정되지 않았습니다 — LLM 공시 분석 배치를 실행할 수 없습니다");
  }

  const anthropicClient: Pick<Anthropic, "messages"> =
    options.anthropicClient ??
    new Anthropic({
      apiKey: config.anthropicApiKey,
      maxRetries: 0, // 재시도는 공통 withRetry로 일원화
      timeout: LLM_REQUEST_TIMEOUT_MS,
    });

  const retryOptions: RetryOptions = {
    sleep: clock.sleep.bind(clock),
    shouldRetry: shouldRetryLlmError,
    ...options.retryOptions,
  };

  return {
    async analyzeDisclosure(input: LlmAnalysisInput): Promise<LlmAnalysisOutcome> {
      const aliasMaps = buildAliasMaps(input);
      const { system, user } = buildAnalysisPrompt(input, aliasMaps);

      try {
        const envelope = await withRetry(async () => {
          await rateLimiter.acquire("LLM");
          const response = await anthropicClient.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            system,
            messages: [{ role: "user", content: user }],
            tools: [
              {
                name: PROPOSE_TOOL_NAME,
                description: "밸류체인 관계 변경 제안 목록을 구조화된 형태로 반환합니다.",
                input_schema: PROPOSE_TOOL_INPUT_SCHEMA,
              },
            ],
            tool_choice: { type: "tool", name: PROPOSE_TOOL_NAME },
          });

          const toolUseBlock = response.content.find(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );
          if (!toolUseBlock) {
            throw new LlmEnvelopeParseError("응답에 tool_use 블록이 없습니다");
          }

          const parsed = llmEnvelopeSchema.safeParse(toolUseBlock.input);
          if (!parsed.success) {
            throw new LlmEnvelopeParseError(`envelope 스키마 검증 실패: ${parsed.error.message}`);
          }
          return parsed.data;
        }, retryOptions);

        const { candidates, droppedItemCount } = mapItemsToCandidates(envelope.proposals, aliasMaps);
        return { proposals: candidates, droppedItemCount };
      } catch (error) {
        throw classifyFinalError(error);
      }
    },
  };
}
