/**
 * UC-024 관계 종류 마스터 관리 도메인 상수(plan M1, spec BR-4/BR-5).
 * FE(admin-relation-types 폼/훅)와 BE(schema.ts Zod 검증)가 동일 스키마를 공용 import한다(DRY, R-7/R-8).
 */
import { z } from "zod";

/** 관계 종류 이름 길이 상한(spec BR-5 "길이 상한은 상수로 관리", R-8). */
export const RELATION_TYPE_NAME_MAX_LENGTH = 50;

/**
 * 관계 종류 이름 검증 스키마 — trim 정규화를 스키마 단계에 내장한다(R-7).
 * 저장되는 name은 항상 이 스키마를 통과한 정규화 값이라는 불변식이 성립한다.
 */
export const relationTypeNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(RELATION_TYPE_NAME_MAX_LENGTH);
