import { BATCH_JOB_TYPES, BATCH_RUN_STATUSES } from "@iib/domain";
import { describe, expect, it } from "vitest";
import {
  BATCH_JOB_TYPE_LABELS,
  BATCH_RUN_STATUS_LABELS,
} from "@/features/admin-batches/constants";

describe("BATCH_JOB_TYPE_LABELS", () => {
  it("BATCH_JOB_TYPES 전체를 빠짐없이 커버한다", () => {
    for (const jobType of BATCH_JOB_TYPES) {
      expect(BATCH_JOB_TYPE_LABELS[jobType]).toBeTypeOf("string");
      expect(BATCH_JOB_TYPE_LABELS[jobType].length).toBeGreaterThan(0);
    }
  });
});

describe("BATCH_RUN_STATUS_LABELS", () => {
  it("BATCH_RUN_STATUSES 전체를 빠짐없이 커버한다", () => {
    for (const status of BATCH_RUN_STATUSES) {
      expect(BATCH_RUN_STATUS_LABELS[status]).toBeTypeOf("string");
      expect(BATCH_RUN_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
