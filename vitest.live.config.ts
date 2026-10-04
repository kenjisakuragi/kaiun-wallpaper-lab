import { defineConfig } from 'vitest/config';

// 実APIを叩くテストだけを手元で実行する設定（CI では使わない）
export default defineConfig({
  test: {
    include: ['**/*.live.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 1_800_000,
  },
});
