"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

/**
 * 브라우저 Supabase 클라이언트 — anon key.
 * (추후 onAuthStateChange 등 UC-004/A-13에서 사용. NEXT_PUBLIC_* 변수는 빌드 시 인라인되므로
 * 반드시 리터럴로 참조해야 한다.)
 */
export const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[lib/supabase/browser-client] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.",
    );
  }

  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: createTimeoutFetch() },
  });
};
