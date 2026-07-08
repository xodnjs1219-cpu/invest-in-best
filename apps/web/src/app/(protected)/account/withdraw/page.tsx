import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WithdrawFlow } from "@/features/account/components/withdraw-flow";
import { createSsrServerClient } from "@/lib/supabase/server-client";

/**
 * `/account/withdraw` — 회원 탈퇴 페이지. Server Component.
 * 비로그인 접근은 로그인 페이지로 유도한다(spec E1, Precondition).
 */
export default async function WithdrawAccountPage() {
  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?returnTo=%2Faccount%2Fwithdraw");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <WithdrawFlow />
    </main>
  );
}
