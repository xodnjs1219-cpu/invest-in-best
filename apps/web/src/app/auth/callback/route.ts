import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { createSsrServerClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

/**
 * GET /auth/callback — 이메일 인증 콜백 (Hono 미경유, spec API 명세 2).
 * `code`(PKCE) 또는 `token_hash`+`type`(Supabase 이메일 링크 유형에 따라 둘 다 지원)로
 * 세션을 수립한 뒤 `redirectTo`(보존된 진입 컨텍스트) 또는 메인으로 이동한다.
 * 실패(만료/재사용/위조 — E9)는 `/auth/verify-error`로 리다이렉트한다(500 화면 금지).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const oauthError = searchParams.get("error");
  const redirectTo = sanitizeReturnTo(searchParams.get("redirectTo"));

  const verifyErrorUrl = new URL("/auth/verify-error", origin);
  verifyErrorUrl.searchParams.set("redirectTo", redirectTo);

  if (oauthError) {
    return NextResponse.redirect(verifyErrorUrl);
  }

  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(verifyErrorUrl);
    }
    return NextResponse.redirect(new URL(redirectTo, origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // Supabase 이메일 인증 링크의 type 파라미터를 그대로 전달한다(예: "signup", "email").
      type: type as "signup" | "email" | "recovery" | "invite" | "email_change",
    });
    if (error) {
      return NextResponse.redirect(verifyErrorUrl);
    }
    return NextResponse.redirect(new URL(redirectTo, origin));
  }

  return NextResponse.redirect(verifyErrorUrl);
}
