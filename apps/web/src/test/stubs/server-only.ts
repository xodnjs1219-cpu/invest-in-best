/**
 * vitest 전용 `server-only` 스텁.
 * 실제 `server-only` 패키지는 react-server 조건 밖에서 import 시 예외를 던지므로,
 * Node 환경 단위 테스트에서는 빈 모듈로 대체한다 (vitest.config.ts alias 참조).
 */
export {};
