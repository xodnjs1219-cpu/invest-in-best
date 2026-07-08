"use client";

import { useReducer } from "react";
import { ApiError } from "@/lib/http/api-client";
import { BackfillProgressCard } from "@/features/admin-batches/components/BackfillProgressCard";
import { BatchFailuresTable } from "@/features/admin-batches/components/BatchFailuresTable";
import { BatchRunDetailPanel } from "@/features/admin-batches/components/BatchRunDetailPanel";
import { BatchRunFilters } from "@/features/admin-batches/components/BatchRunFilters";
import { BatchRunsPagination } from "@/features/admin-batches/components/BatchRunsPagination";
import { BatchRunsTable } from "@/features/admin-batches/components/BatchRunsTable";
import {
  adminBatchesReducer,
  initialAdminBatchesState,
} from "@/features/admin-batches/hooks/adminBatchesReducer";
import { useBackfillProgressQuery } from "@/features/admin-batches/hooks/useBackfillProgressQuery";
import { useBatchRunDetailQuery } from "@/features/admin-batches/hooks/useBatchRunDetailQuery";
import { useBatchRunFailuresQuery } from "@/features/admin-batches/hooks/useBatchRunFailuresQuery";
import { useBatchRunsQuery } from "@/features/admin-batches/hooks/useBatchRunsQuery";

/**
 * `/admin/batches` 페이지 컨테이너(R-8). `useReducer` + 쿼리 훅을 소유하고
 * Presenter에 값+콜백을 배선한다. 조회 전용이므로 뮤테이션/낙관적 갱신 없음(BR-1).
 * 폴링은 훅 옵션에 내장되어 있어(R-6) 이 컴포넌트에 타이머 코드가 없다 —
 * 언마운트되면 자동으로 폴링이 중단된다(Main 7 "화면 이탈 시 중단").
 */
export default function AdminBatchesPage() {
  const [state, dispatch] = useReducer(adminBatchesReducer, initialAdminBatchesState);
  // 파생값(렌더 중 식) — running 행의 경과 시간(M11)이 폴링 리렌더마다 갱신되도록
  // 상태로 보관하지 않고 매 렌더에서 재계산한다(R-8·E10).
  const now = new Date();

  const filters = { jobType: state.jobType, status: state.status, from: state.from, to: state.to };
  const runsQuery = useBatchRunsQuery(filters, state.page);
  const backfillQuery = useBackfillProgressQuery();
  const detailQuery = useBatchRunDetailQuery(state.selectedRunId);
  const failuresQuery = useBatchRunFailuresQuery(state.selectedRunId, state.failuresPage);

  const runs = runsQuery.data?.runs ?? [];
  const pagination = runsQuery.data?.pagination ?? { page: state.page, pageSize: 20, totalCount: 0 };
  const isPanelOpen = state.selectedRunId !== null;
  const isDetailNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">배치 작업 모니터링</h1>

      <BackfillProgressCard
        progress={backfillQuery.data ?? null}
        isLoading={backfillQuery.isPending}
        isError={backfillQuery.isError}
      />

      <BatchRunFilters
        value={filters}
        onChange={(patch) => dispatch({ type: "FILTER_CHANGED", ...patch })}
        onReset={() =>
          dispatch({ type: "FILTER_CHANGED", jobType: null, status: null, from: null, to: null })
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BatchRunsTable
            runs={runs}
            isLoading={runsQuery.isPending}
            isError={runsQuery.isError}
            onRetry={() => runsQuery.refetch()}
            selectedRunId={state.selectedRunId}
            onSelect={(runId) => dispatch({ type: "RUN_SELECTED", runId })}
            now={now}
          />
          <BatchRunsPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            onPageChange={(page) => dispatch({ type: "PAGE_CHANGED", page })}
          />
        </div>

        {isPanelOpen && (
          <BatchRunDetailPanel
            run={detailQuery.data?.run ?? null}
            isLoading={detailQuery.isPending}
            isError={detailQuery.isError && !isDetailNotFound}
            isNotFound={isDetailNotFound}
            onRetry={() => detailQuery.refetch()}
            onClose={() => dispatch({ type: "DETAIL_CLOSED" })}
            failuresSlot={
              <BatchFailuresTable
                failures={failuresQuery.data?.failures ?? []}
                totalCount={failuresQuery.data?.pagination.totalCount ?? 0}
                page={state.failuresPage}
                pageSize={failuresQuery.data?.pagination.pageSize ?? 20}
                isLoading={failuresQuery.isPending}
                isError={failuresQuery.isError}
                onPageChange={(page) => dispatch({ type: "FAILURES_PAGE_CHANGED", page })}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
