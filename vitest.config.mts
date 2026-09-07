import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // `import 'server-only'` 를 빈 모듈로 돌린다 — 이유는 그 파일에 적었다.
  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./vitest.server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
