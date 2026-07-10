"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type AdminNavItem = { href: string; label: string };

type AdminNavProps = {
  items: readonly AdminNavItem[];
};

/**
 * 어드민 콘솔 내비게이션(레이아웃 헤더용) — 현재 경로 활성 강조.
 * `usePathname()`로 현재 경로를 감지해 활성 링크를 강조한다(레이아웃은 Server Component 유지).
 */
export function AdminNav({ items }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-sm">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              isActive ? "text-accent" : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
