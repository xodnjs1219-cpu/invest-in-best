import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ACCOUNT_MESSAGES } from "@/features/account/constants";
import { createSsrServerClient } from "@/lib/supabase/server-client";

/** `/account` — 계정 메뉴 페이지. 최소 골격(프로필 표시 + 회원 탈퇴 진입점). */
export default async function AccountPage() {
  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?returnTo=%2Faccount");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">계정</h1>
      <p className="text-sm text-gray-500">{user.email}</p>
      <Link href="/account/withdraw" className="text-red-600 underline">
        {ACCOUNT_MESSAGES.menuLinkLabel}
      </Link>
    </main>
  );
}
