import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: 'https://opora-core-api.p4d-b2q.workers.dev',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
