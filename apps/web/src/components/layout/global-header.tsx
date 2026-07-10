"use client";

import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui";
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
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 text-fg shadow-ambient backdrop-blur-md">
      <div className="flex items-center gap-5">
        <Link href="/" className="text-fg transition-colors hover:text-accent">
          invest-in-best
        </Link>
        <Link href="/explore" className="text-sm text-fg-muted transition-colors hover:text-accent">
          탐색
        </Link>
      </div>
      {status === "authenticated" && user ? (
        <UserMenu email={user.email} role={user.role} isLoggingOut={isPending} onLogout={logout} />
      ) : (
        <nav className="flex items-center gap-3 text-sm text-fg-muted">
          <Link href="/auth/login" className="transition-colors hover:text-accent">
            {AUTH_LOGOUT_MESSAGES.loginLabel}
          </Link>
          <Button as="link" href="/auth/signup" size="sm">
            {AUTH_LOGOUT_MESSAGES.signupLabel}
          </Button>
        </nav>
      )}
    </header>
  );
}
