"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_QUERY_RETRY_COUNT, DEFAULT_QUERY_STALE_TIME_MS } from "@iib/domain";
import { CurrentUserProvider } from "@/features/auth/context/current-user-provider";

/**
 * 루트 Providers — TanStack Query 캐시 + 전역 인증 상태(CurrentUserProvider)를 장착한다.
 * 전역 기본 옵션은 보수적으로 설정하고, 404류 무재시도 등 개별 정책은 각 쿼리 훅에서 오버라이드한다
 * (UC-009 plan 모듈 A6).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_QUERY_STALE_TIME_MS,
            retry: DEFAULT_QUERY_RETRY_COUNT,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CurrentUserProvider>{children}</CurrentUserProvider>
    </QueryClientProvider>
  );
}
