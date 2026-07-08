import { RELATION_TYPE_NAME_MAX_LENGTH } from "@iib/domain";
import { describe, expect, it } from "vitest";
import {
  AdminRelationTypeListResponseSchema,
  AdminRelationTypeRpcRowSchema,
  RelationTypeCreateRequestSchema,
  RelationTypeIdParamSchema,
  RelationTypeMutationResponseSchema,
  RelationTypeRowSchema,
  RelationTypeUpdateRequestSchema,
} from "./schema";

describe("RelationTypeCreateRequestSchema (M3, spec API-2/BR-4)", () => {
  it("isDirected 미지정 시 true로 기본값 처리된다(BR-4)", () => {
    const result = RelationTypeCreateRequestSchema.safeParse({ name: "라이선스" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDirected).toBe(true);
    }
  });

  it("name의 앞뒤 공백이 trim되어 통과한다(R-7)", () => {
    const result = RelationTypeCreateRequestSchema.safeParse({ name: "  라이선스 " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("라이선스");
    }
  });

  it("name 누락 시 실패한다(E7)", () => {
    expect(RelationTypeCreateRequestSchema.safeParse({}).success).toBe(false);
  });

  it("name이 공백만 있으면 실패한다(E7)", () => {
    expect(RelationTypeCreateRequestSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it(`name이 ${RELATION_TYPE_NAME_MAX_LENGTH + 1}자면 실패한다(E7)`, () => {
    const name = "가".repeat(RELATION_TYPE_NAME_MAX_LENGTH + 1);
    expect(RelationTypeCreateRequestSchema.safeParse({ name }).success).toBe(false);
  });

  it("isDirected가 boolean이 아니면 실패한다(타입 오류)", () => {
    expect(
      RelationTypeCreateRequestSchema.safeParse({ name: "공급", isDirected: "yes" }).success,
    ).toBe(false);
  });

  it("isDirected: false를 명시하면 그대로 반영된다", () => {
    const result = RelationTypeCreateRequestSchema.safeParse({ name: "경쟁", isDirected: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDirected).toBe(false);
    }
  });

  it("미지 키가 포함되면 strict 위반으로 실패한다", () => {
    expect(
      RelationTypeCreateRequestSchema.safeParse({ name: "공급", extra: "x" }).success,
    ).toBe(false);
  });
});

describe("RelationTypeUpdateRequestSchema (M3, spec API-3/R-6)", () => {
  it("빈 객체는 실패한다(수정 필드 0개)", () => {
    expect(RelationTypeUpdateRequestSchema.safeParse({}).success).toBe(false);
  });

  it("isActive만 있으면 통과한다", () => {
    expect(RelationTypeUpdateRequestSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("name과 isActive를 동시에 지정하면 통과한다", () => {
    const result = RelationTypeUpdateRequestSchema.safeParse({ name: "공급(부품)", isActive: true });
    expect(result.success).toBe(true);
  });

  it("isDirected가 포함되면 strict 위반으로 실패한다(R-6/BR-4)", () => {
    expect(
      RelationTypeUpdateRequestSchema.safeParse({ isDirected: false }).success,
    ).toBe(false);
  });

  it("name만 있어도 통과한다", () => {
    expect(RelationTypeUpdateRequestSchema.safeParse({ name: "새이름" }).success).toBe(true);
  });
});

describe("RelationTypeIdParamSchema", () => {
  it("uuid가 아닌 문자열은 실패한다", () => {
    expect(RelationTypeIdParamSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("uuid 형식은 통과한다", () => {
    expect(
      RelationTypeIdParamSchema.safeParse("123e4567-e89b-12d3-a456-426614174000").success,
    ).toBe(true);
  });
});

describe("AdminRelationTypeRpcRowSchema (M3, admin_list_relation_types 반환 행)", () => {
  it("snake_case 행을 파싱한다", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "공급",
      is_directed: true,
      is_active: true,
      is_in_use: false,
      created_at: "2026-07-01T09:00:00+09:00",
      updated_at: "2026-07-05T09:00:00+09:00",
    };
    expect(AdminRelationTypeRpcRowSchema.safeParse(row).success).toBe(true);
  });
});

describe("RelationTypeRowSchema (M3, INSERT/UPDATE 반환 행)", () => {
  it("is_in_use 없이도 파싱된다", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "공급",
      is_directed: true,
      is_active: true,
      created_at: "2026-07-01T09:00:00+09:00",
      updated_at: "2026-07-05T09:00:00+09:00",
    };
    expect(RelationTypeRowSchema.safeParse(row).success).toBe(true);
  });
});

describe("Response schemas (spec 계약 camelCase)", () => {
  it("AdminRelationTypeListResponseSchema는 relationTypes 배열을 요구한다", () => {
    const payload = {
      relationTypes: [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "공급",
          isDirected: true,
          isActive: true,
          isInUse: true,
          createdAt: "2026-07-01T09:00:00+09:00",
          updatedAt: "2026-07-05T09:00:00+09:00",
        },
      ],
    };
    expect(AdminRelationTypeListResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("RelationTypeMutationResponseSchema는 id/name/isDirected/isActive를 요구한다", () => {
    const payload = { id: "123e4567-e89b-12d3-a456-426614174000", name: "라이선스", isDirected: true, isActive: true };
    expect(RelationTypeMutationResponseSchema.safeParse(payload).success).toBe(true);
  });
});
