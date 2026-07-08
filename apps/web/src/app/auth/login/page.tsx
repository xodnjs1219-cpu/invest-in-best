import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { GoogleLoginSection } from "@/features/auth/components/google-login-section";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { createSsrServerClient } from "@/lib/supabase/server-client";

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

/**
 * `/auth/login` — 로그인 페이지. Next.js 16 규약에 따라 `searchParams`는 Promise다.
 * 이미 로그인 상태면 복귀 목적지(returnTo, 없으면 메인)로 리다이렉트한다(spec Edge Case).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(rawReturnTo, "");

  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(returnTo || "/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">로그인</h1>
      <LoginForm returnTo={returnTo || undefined} />
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        또는
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <GoogleLoginSection redirectPath={returnTo || undefined} />
    </main>
  );
}
