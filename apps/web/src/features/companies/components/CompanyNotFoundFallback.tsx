import { Button } from "@/components/ui";
import {
  COMPANY_NOT_FOUND_HOME_LABEL,
  COMPANY_NOT_FOUND_MESSAGE,
  COMPANY_NOT_FOUND_SEARCH_LABEL,
} from "@/features/companies/constants";

/** E1/E13 — 미존재/미상장 안내 + 메인/검색 유도. 로직 없는 Presenter. */
export function CompanyNotFoundFallback() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius)] border border-border py-16 text-center">
      <p className="text-fg-muted">{COMPANY_NOT_FOUND_MESSAGE}</p>
      <div className="flex gap-3">
        <Button as="link" href="/" variant="primary">
          {COMPANY_NOT_FOUND_HOME_LABEL}
        </Button>
        <Button as="link" href="/securities/search" variant="secondary">
          {COMPANY_NOT_FOUND_SEARCH_LABEL}
        </Button>
      </div>
    </div>
  );
}
