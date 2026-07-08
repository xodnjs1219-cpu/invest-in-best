/**
 * 워커 환경설정 (docs/usecases/026/plan.md 모듈 2).
 * 환경변수 접근의 단일 진입점 — 하드코딩 금지. techstack §9의 키 이름을 그대로 사용한다.
 * Node 24 내장 process.loadEnvFile()로 루트 .env를 읽고(dotenv 불필요), zod로 기동 시점에 조기 검증한다.
 */
import path from "node:path";
import { z } from "zod";

const workerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TOSSINVEST_CLIENT_ID: z.string().min(1),
  TOSSINVEST_CLIENT_SECRET: z.string().min(1),
  // UC-027(collect-financials) 확장 — OpenDART/SEC 자격 정보. 기동 시점 조기 검증(E7).
  OPENDART_API_KEY: z.string().length(40, "OPENDART_API_KEY는 40자리 인증키여야 합니다"),
  SEC_EDGAR_USER_AGENT: z
    .string()
    .refine((v) => v.includes("@"), "SEC_EDGAR_USER_AGENT는 '서비스명 연락이메일' 형식(이메일 포함)이어야 합니다"),
  WORKER_TMP_DIR: z.string().min(1).optional(),
});

export interface WorkerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  tossClientId: string;
  tossClientSecret: string;
  opendartApiKey: string;
  secEdgarUserAgent: string;
  workerTmpDir: string | undefined;
}

/**
 * .env 파일을 안전하게 로드한다. 파일이 없으면 조용히 무시한다(배포 환경은 주입 env 사용).
 * 기본 후보: cwd/.env(루트 실행), cwd/../../.env(`npm -w apps/worker` 실행 시 모노레포 루트).
 */
export function tryLoadEnvFiles(candidates?: string[]): void {
  const paths = candidates ?? [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const envPath of paths) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // 파일 부재/파싱 불가 시 무시 — process.env 값으로 동작한다.
    }
  }
}

/** env 객체를 검증해 타입 안전 설정을 반환한다. 실패 시 누락 키 이름을 포함해 throw. */
export function loadWorkerConfig(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const parsed = workerEnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`[worker/config] 환경변수 검증 실패 — ${details}`);
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    tossClientId: parsed.data.TOSSINVEST_CLIENT_ID,
    tossClientSecret: parsed.data.TOSSINVEST_CLIENT_SECRET,
    opendartApiKey: parsed.data.OPENDART_API_KEY,
    secEdgarUserAgent: parsed.data.SEC_EDGAR_USER_AGENT,
    workerTmpDir: parsed.data.WORKER_TMP_DIR,
  };
}

let cachedConfig: WorkerConfig | null = null;

/** lazy 싱글턴 — 최초 호출 시 .env 로드 + 검증. 실패하면 기동 시점에 조기 실패한다. */
export function getWorkerConfig(): WorkerConfig {
  if (cachedConfig === null) {
    tryLoadEnvFiles();
    cachedConfig = loadWorkerConfig();
  }
  return cachedConfig;
}
