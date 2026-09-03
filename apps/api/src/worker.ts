import { createApp } from './index';
import { D1DataPort } from '@opora/data-runtime';
import { D1MetadataPort } from '@opora/metadata';
import { D1OutboxDrainPort, D1WorkflowRunsPort } from './runs';
import { AutomationService } from './automation';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  /** JSON-мапа connection slug → URL: {"slack":"https://hooks.example/..."} */
  CONNECTIONS?: string;
  /** Захист POST /v1/automation/drain */
  DRAIN_KEY?: string;
  /** Секрет для HMAC-підпису токенів */
  AUTH_SECRET?: string;
}

function buildParts(env: Env) {
  const connections = parseConnections(env);
  return {
    connections,
    metadata: new D1MetadataPort(env.DB),
    data: new D1DataPort(env.DB),
    outbox: new D1OutboxDrainPort(env.DB),
    runs: new D1WorkflowRunsPort(env.DB),
    authSecret: env.AUTH_SECRET,
    webhookPost: async (url: string, body: unknown) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
        return { ok: res.ok, status: res.status };
      } catch (e) {
        return { ok: false, error: String(e).slice(0, 120) };
      }
    },
  };
}

function parseConnections(env: Env): Record<string, string> {
  try {
    return env.CONNECTIONS ? (JSON.parse(env.CONNECTIONS) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const parts = buildParts(env);
    const app = createApp({
      metadata: parts.metadata,
      data: parts.data,
      authSecret: env.AUTH_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
      automation: {
        outbox: parts.outbox,
        runs: parts.runs,
        resolveConnection: (slug) => parts.connections[slug] ?? null,
        webhookPost: parts.webhookPost,
      },
      drainKey: env.DRAIN_KEY,
    });
    return app.fetch(request);
  },

  /** Хвилинний дрен outbox → виконання workflow (блюпринт §6) */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    void controller;
    const parts = buildParts(env);
    const service = new AutomationService({
      ...parts,
      resolveConnection: (slug) => parts.connections[slug] ?? null,
    });
    const report = await service.drain();
    if (report.processed > 0) {
      console.log('[scheduled-drain]', JSON.stringify(report));
    }
  },
};
