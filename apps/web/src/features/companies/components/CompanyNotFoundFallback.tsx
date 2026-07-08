import Link from "next/link";
import {
  COMPANY_NOT_FOUND_HOME_LABEL,
  COMPANY_NOT_FOUND_MESSAGE,
  COMPANY_NOT_FOUND_SEARCH_LABEL,
} from "@/features/companies/constants";

/** E1/E13 — 미존재/미상장 안내 + 메인/검색 유도. 로직 없는 Presenter. */
export function CompanyNotFoundFallback() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-gray-200 py-16 text-center">
      <p className="text-gray-700">{COMPANY_NOT_FOUND_MESSAGE}</p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {COMPANY_NOT_FOUND_HOME_LABEL}
        </Link>
        <Link
          href="/securities/search"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {COMPANY_NOT_FOUND_SEARCH_LABEL}
        </Link>
      </div>
    </div>
  );
}
