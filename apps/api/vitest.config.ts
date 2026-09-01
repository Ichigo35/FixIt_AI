import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    // Tests d'intégration contre Neon : tolérer le cold-start (scale-to-zero).
    testTimeout: 20000,
  },
});
