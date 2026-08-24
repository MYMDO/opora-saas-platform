import { createApp } from './index';
import { D1DataPort } from '@opora/data-runtime';
import { D1MetadataPort } from '@opora/metadata';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      metadata: new D1MetadataPort(env.DB),
      data: new D1DataPort(env.DB),
      allowedOrigins: env.ALLOWED_ORIGINS,
    });
    return app.fetch(request);
  },
};
