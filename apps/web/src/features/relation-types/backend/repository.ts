import type { SupabaseClient } from "@supabase/supabase-js";

const RELATION_TYPES_TABLE = "relation_types";
const RELATION_TYPES_SELECT = "id, name, is_directed, is_active";

export type FindAllRelationTypesFilter = { activeOnly: boolean };

export type FindAllRelationTypesResult = { rows: unknown[]; error: string | null };

/** 서비스는 이 인터페이스에만 의존한다(Supabase 쿼리 문법 비의존). */
export interface RelationTypeRepository {
  findAllRelationTypes(filter: FindAllRelationTypesFilter): Promise<FindAllRelationTypesResult>;
}

/**
 * `relation_types` SELECT 캡슐화(UC-016 plan 모듈 M6).
 * `activeOnly=true`면 `is_active=true` 필터(idx_relation_types_active 활용).
 * 정렬은 `created_at ASC`로 선택 목록 순서를 안정화한다.
 */
export const createRelationTypeRepository = (client: SupabaseClient): RelationTypeRepository => ({
  async findAllRelationTypes({ activeOnly }) {
    let query = client.from(RELATION_TYPES_TABLE).select(RELATION_TYPES_SELECT);
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query.order("created_at", { ascending: true });

    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: data ?? [], error: null };
  },
});
