import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// `globals: true`를 쓰지 않으므로 RTL 자동 cleanup이 등록되지 않는다 — 명시적으로 등록.
afterEach(() => {
  cleanup();
});

// 통합 성격 테스트(Hono 미들웨어 체인 등)가 backend/config 검증을 통과할 수 있도록
// 미설정 시에만 테스트용 기본값을 채운다 (실제 운영 값 아님 — 테스트 픽스처).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
