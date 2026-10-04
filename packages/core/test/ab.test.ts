import { describe, expect, it } from 'vitest';
import { assignVariant } from '../src/ab.ts';

const SALT = 'test-ab-salt';

describe('A/B 割り当て（docs/07 M1 完了条件）', () => {
  it('同じ userId は常に同じ群', () => {
    for (let i = 0; i < 200; i++) {
      const id = `U${i.toString(16).padStart(32, '0')}`;
      const first = assignVariant(id, SALT);
      for (let k = 0; k < 5; k++) expect(assignVariant(id, SALT)).toBe(first);
    }
  });

  it('擬似ID 1万件で A の比率が 48〜52%', () => {
    let a = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      // LINE の userId に似せた形式（U + 32桁の16進）
      const id = `U${(i * 2654435761).toString(16).padStart(32, '0')}`;
      if (assignVariant(id, SALT) === 'A') a++;
    }
    const ratio = a / n;
    expect(ratio).toBeGreaterThanOrEqual(0.48);
    expect(ratio).toBeLessThanOrEqual(0.52);
  });

  it('A と B の両方が出る', () => {
    const set = new Set(Array.from({ length: 50 }, (_, i) => assignVariant(`user-${i}`, SALT)));
    expect(set).toEqual(new Set(['A', 'B']));
  });

  it('ソルトが空なら例外', () => {
    expect(() => assignVariant('U1', '')).toThrow();
  });
});
