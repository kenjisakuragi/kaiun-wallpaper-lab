import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    // 実APIを叩くテストは CI・通常実行から外す（CLAUDE.md コード規約）
    exclude: ['**/node_modules/**', '**/*.live.test.ts'],
    testTimeout: 20_000,
  },
});
