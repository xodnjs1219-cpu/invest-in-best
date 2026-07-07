import { describe, expect, it } from "vitest";
import { createHonoApp } from "@/backend/hono/app";

describe("GET /api/example/health", () => {
  it("returns ok status", async () => {
    const app = createHonoApp();
    const res = await app.request("/api/example/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { status: "ok" } });
  });
});
