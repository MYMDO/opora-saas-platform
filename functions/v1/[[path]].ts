import { createApp, type Env } from '../../worker/src/index';

interface PagesContext {
  request: Request;
  env: unknown;
}

type MinimalExecCtx = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

/** Same-origin API: той самий Hono-додаток, що й на workers.dev, але без CORS-залежності. */
export const onRequest = async (ctx: PagesContext): Promise<Response> => {
  const env = ctx.env as Env;
  const execCtx: MinimalExecCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
  return createApp(env).fetch(ctx.request, env, execCtx as ExecutionContext);
};
