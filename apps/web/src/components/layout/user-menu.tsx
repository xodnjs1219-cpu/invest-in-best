import Link from "next/link";
import { AUTH_LOGOUT_MESSAGES } from "@/features/auth/constants";

type UserMenuProps = {
  email: string;
  role: "user" | "admin";
  isLoggingOut: boolean;
  onLogout: () => void;
};

/** 계정 메뉴 Presenter — dispatch·훅·라우터를 모르는 순수 프레젠터. */
export function UserMenu({ email, role, isLoggingOut, onLogout }: UserMenuProps) {
  return (
    <div
      className="flex items-center gap-3 text-fg-muted"
      aria-label={AUTH_LOGOUT_MESSAGES.menuLabel}
    >
      <Link href="/account" className="text-sm transition-colors hover:text-accent">
        {email}
      </Link>
      {role === "admin" && (
        <Link href="/admin" className="text-sm underline transition-colors hover:text-accent">
          {AUTH_LOGOUT_MESSAGES.adminMenuLabel}
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="text-sm underline transition-colors hover:text-fg disabled:opacity-60"
      >
        {isLoggingOut ? AUTH_LOGOUT_MESSAGES.loggingOutLabel : AUTH_LOGOUT_MESSAGES.logoutLabel}
      </button>
    </div>
  );
}
