/**
 * FE ↔ backend 타입 경계 (plan S4) — FE(hooks/components)는 이 파일만 import하고
 * backend/schema.ts 내부 경로에 직접 결합하지 않는다(레이어 경계 규약).
 */
export type {
  ProposalListItem,
  ProposalListResponse,
  ProposalApproveResponse,
  ProposalRejectResponse,
  ProposalListQuery,
  ProposalRejectRequest,
} from "@/features/admin-llm-proposals/backend/schema";
