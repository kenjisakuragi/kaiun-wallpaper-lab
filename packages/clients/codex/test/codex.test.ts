import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodexImageError, createCodexImageClient, type Spawner } from '../src/index.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaiun-codex-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('codex 画像クライアント（codex 本体は呼ばずにモック）', () => {
  it('codex exec を書き込み可能サンドボックスで呼び、保存された PNG を返す', async () => {
    const calls: { bin: string; args: string[]; cwd: string }[] = [];
    const spawner: Spawner = async (bin, args, { cwd }) => {
      calls.push({ bin, args, cwd });
      writeFileSync(join(cwd, 'birthday_03-01_v1.png'), 'png-bytes');
      return { code: 0, timedOut: false, output: '' };
    };
    const c = createCodexImageClient({ codexBin: 'C:/codex.exe', workDir: dir, spawner });
    const r = await c.generate('draw something', 'birthday_03-01_v1');
    expect(Buffer.from(r.png).toString()).toBe('png-bytes');
    expect(r).toMatchObject({ model: 'chatgpt-codex', quality: 'n/a', costUsd: 0 });
    const call = calls[0];
    expect(call?.bin).toBe('C:/codex.exe');
    expect(call?.args.slice(0, 4)).toEqual(['exec', '--skip-git-repo-check', '-c', 'sandbox_mode=workspace-write']);
    expect(call?.args[4]).toContain('draw something');
    expect(call?.args[4]).toContain('birthday_03-01_v1.png');
  });

  it('時間切れ・保存されなかった場合は例外', async () => {
    const timeout: Spawner = async () => ({ code: null, timedOut: true, output: '' });
    await expect(createCodexImageClient({ codexBin: 'x', workDir: dir, spawner: timeout }).generate('p', 'a')).rejects.toThrow(/timed out/);
    const nothing: Spawner = async () => ({ code: 0, timedOut: false, output: 'done' });
    await expect(createCodexImageClient({ codexBin: 'x', workDir: dir, spawner: nothing }).generate('p', 'a')).rejects.toBeInstanceOf(CodexImageError);
  });

  it('前回の残りファイルを生成結果と取り違えない', async () => {
    writeFileSync(join(dir, 'old.png'), 'stale');
    const nothing: Spawner = async () => ({ code: 0, timedOut: false, output: '' });
    await expect(createCodexImageClient({ codexBin: 'x', workDir: dir, spawner: nothing }).generate('p', 'old')).rejects.toThrow(/did not save/);
  });

  it('ファイル名に使えない文字は拒否', async () => {
    const spawner: Spawner = async () => ({ code: 0, timedOut: false, output: '' });
    await expect(createCodexImageClient({ codexBin: 'x', workDir: dir, spawner }).generate('p', '../evil')).rejects.toThrow(/invalid image name/);
  });
});
