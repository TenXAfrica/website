import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-function tests only. Nothing here may touch the network:
    // every test that needs fetch injects its own stub.
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
  },
});
