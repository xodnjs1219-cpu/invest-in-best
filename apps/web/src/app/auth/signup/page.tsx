import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignupPageClient } from "@/app/auth/signup/signup-page-client";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { createSsrServerClient } from "@/lib/supabase/server-client";

type SignupPageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

/**
 * `/auth/signup` — 회원가입 페이지. Next.js 16 규약에 따라 `searchParams`는 Promise다.
 * 이미 로그인 상태면 메인으로 리다이렉트하고, `redirectTo` 쿼리를 정제해 폼/콜백에 전달한다.
 */
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { redirectTo: rawRedirectTo } = await searchParams;
  const redirectTo = sanitizeReturnTo(rawRedirectTo, "");

  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <SignupPageClient redirectTo={redirectTo || undefined} />
    </main>
  );
}
