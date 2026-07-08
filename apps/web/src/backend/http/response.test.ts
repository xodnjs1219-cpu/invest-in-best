import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { failure, respond, success } from "@/backend/http/response";

describe("success", () => {
  it("success(data)가 {ok:true, status:200, data}를 반환한다", () => {
    expect(success({ a: 1 })).toEqual({ ok: true, status: 200, data: { a: 1 } });
  });

  it("상태 코드를 지정할 수 있다", () => {
    expect(success({ a: 1 }, 201).status).toBe(201);
  });
});

describe("failure", () => {
  it("failure(400,'X','msg',details)가 {ok:false, status:400, error:{code,message,details}}를 반환한다", () => {
    expect(failure(400, "X", "msg", { field: "email" })).toEqual({
      ok: false,
      status: 400,
      error: { code: "X", message: "msg", details: { field: "email" } },
    });
  });
});

describe("respond", () => {
  it("result.status를 HTTP 상태 코드로 그대로 사용한다", async () => {
    // Arrange
    const app = new Hono();
    app.get("/ok", (c) => respond(c, success({ done: true }, 201)));
    app.get("/fail", (c) => respond(c, failure(429, "RATE_LIMITED", "too many")));

    // Act
    const okRes = await app.request("/ok");
    const failRes = await app.request("/fail");

    // Assert
    expect(okRes.status).toBe(201);
    expect(await okRes.json()).toEqual({ data: { done: true } });
    expect(failRes.status).toBe(429);
    expect(await failRes.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "too many" },
    });
  });
});
