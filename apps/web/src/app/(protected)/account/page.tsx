import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heading, PageShell } from "@/components/ui";
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
    <PageShell width="sm">
      <Heading level={1}>계정</Heading>
      <p className="text-sm text-fg-muted">{user.email}</p>
      <Link
        href="/account/withdraw"
        className="text-danger underline underline-offset-2 self-start"
      >
        {ACCOUNT_MESSAGES.menuLinkLabel}
      </Link>
    </PageShell>
  );
}
