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
    return <header data-testid="header-skeleton" className="h-12" />;
  }

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link href="/" className="font-semibold">
        invest-in-best
      </Link>
      {status === "authenticated" && user ? (
        <UserMenu email={user.email} role={user.role} isLoggingOut={isPending} onLogout={logout} />
      ) : (
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/auth/login">{AUTH_LOGOUT_MESSAGES.loginLabel}</Link>
          <Link href="/auth/signup">{AUTH_LOGOUT_MESSAGES.signupLabel}</Link>
        </nav>
      )}
    </header>
  );
}
