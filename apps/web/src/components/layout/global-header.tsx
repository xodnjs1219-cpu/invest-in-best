"use client";

import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { AUTH_LOGOUT_MESSAGES } from "@/features/auth/constants";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { useLogout } from "@/features/auth/hooks/useLogout";

/** 전역 헤더 Container — 인증 상태·로그아웃 훅을 소비해 하위 프레젠터에 위임한다. */
export function GlobalHeader() {
  const { status, user } = useCurrentUser();
  const { logout, isPending } = useLogout();

  if (status === "loading") {
    return <header data-testid="header-skeleton" className="h-14" />;
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 backdrop-blur-md">
      <div className="flex items-center gap-5">
        <Link href="/" className="font-semibold text-white">
          invest-in-best
        </Link>
        <Link href="/explore" className="text-sm text-slate-300 transition hover:text-white">
          탐색
        </Link>
      </div>
      {status === "authenticated" && user ? (
        <UserMenu email={user.email} role={user.role} isLoggingOut={isPending} onLogout={logout} />
      ) : (
        <nav className="flex items-center gap-3 text-sm text-slate-300">
          <Link href="/auth/login" className="transition hover:text-white">
            {AUTH_LOGOUT_MESSAGES.loginLabel}
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3.5 py-1.5 font-medium text-slate-950 transition hover:opacity-90"
          >
            {AUTH_LOGOUT_MESSAGES.signupLabel}
          </Link>
        </nav>
      )}
    </header>
  );
}
