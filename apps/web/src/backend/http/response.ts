import type { Context } from "hono";

export type SuccessResult<T> = {
  ok: true;
  status: number;
  data: T;
};

export type ErrorResult<E extends string, M = unknown> = {
  ok: false;
  status: number;
  error: {
    code: E;
    message: string;
    details?: M;
  };
};

export type HandlerResult<T, E extends string, M = unknown> = SuccessResult<T> | ErrorResult<E, M>;

export const success = <T>(data: T, status = 200): SuccessResult<T> => ({
  ok: true,
  status,
  data,
});

export const failure = <E extends string, M = unknown>(
  status: number,
  code: E,
  message: string,
  details?: M,
): ErrorResult<E, M> => ({
  ok: false,
  status,
  error: { code, message, details },
});

export const respond = <T, E extends string, M>(c: Context, result: HandlerResult<T, E, M>) => {
  if (result.ok) {
    return c.json({ data: result.data }, result.status as never);
  }
  return c.json({ error: result.error }, result.status as never);
};
