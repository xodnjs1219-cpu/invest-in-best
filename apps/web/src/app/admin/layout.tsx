import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSsrServerClient } from "@/lib/supabase/server-client";
import { createServiceClient } from "@/lib/supabase/service-client";

const PROFILES_TABLE = "profiles";
const ADMIN_ENTRY_PATH = "/admin/llm-proposals";

/**
 * `/admin/*` 화면 가드(UC-022 plan M2, 공유 — UC-021/023/024가 동일 레이아웃을 재사용).
 * 서버 컴포넌트에서 세션·role을 확인해 비-Admin 접근을 차단한다(E12의 화면 진입 차단).
 * **화면 가드는 UX 편의일 뿐이며 인가의 진실은 API 미들웨어(`withAdminAuth`, BR-10)다** —
 * 이 레이아웃이 우회되어도(예: 클라이언트 라우팅) API가 401/403으로 최종 방어한다.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(ADMIN_ENTRY_PATH)}`);
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from(PROFILES_TABLE)
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="border-b pb-4">
        <h1 className="text-lg font-semibold">관리자 콘솔</h1>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
