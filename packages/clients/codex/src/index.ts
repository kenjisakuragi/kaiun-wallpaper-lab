// codex 経由の ChatGPT 画像生成（主経路。docs/04 §1-1）。ローカルPC専用。
// 1枚ずつ頼む・標準入力を閉じる・書き込み可能なサンドボックス・1枚の上限時間、はスキル codex-imagegen の決めごと。

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export type SpawnResult = { code: number | null; timedOut: boolean; output: string };
export type Spawner = (bin: string, args: string[], opts: { cwd: string; timeoutMs: number }) => Promise<SpawnResult>;

export const defaultSpawner: Spawner = (bin, args, { cwd, timeoutMs }) =>
  new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let timedOut = false;
    const keep = (b: Buffer) => {
      output = (output + b.toString('utf8')).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut, output });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, timedOut, output: String(e) });
    });
  });

export class CodexImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexImageError';
  }
}

export type CodexImageClientOptions = {
  codexBin: string;
  /** 生成物を置く作業フォルダ（1枚ごとにこの中で生成する） */
  workDir: string;
  timeoutMs?: number;
  spawner?: Spawner;
};

export type GeneratedImage = { png: Uint8Array; model: string; quality: string; costUsd: number };

export function createCodexImageClient(opts: CodexImageClientOptions) {
  const spawner = opts.spawner ?? defaultSpawner;
  const timeoutMs = opts.timeoutMs ?? 900_000;

  /** name は保存ファイル名（拡張子なし、英数と - _ のみ） */
  async function generate(prompt: string, name: string): Promise<GeneratedImage> {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new CodexImageError(`invalid image name: ${name}`);
    mkdirSync(opts.workDir, { recursive: true });
    const outPath = join(opts.workDir, `${name}.png`);
    rmSync(outPath, { force: true });
    const instruction = `${prompt}\n\n【保存先】生成した画像を1枚だけ、PNG で ${outPath.replace(/\\/g, '/')} として保存してください。ほかのファイルは作らないでください。`;
    const r = await spawner(opts.codexBin, ['exec', '--skip-git-repo-check', '-c', 'sandbox_mode=workspace-write', instruction], {
      cwd: opts.workDir,
      timeoutMs,
    });
    if (r.timedOut) throw new CodexImageError(`codex timed out after ${timeoutMs}ms`);
    if (!existsSync(outPath)) throw new CodexImageError(`codex did not save the image (exit ${r.code}): ${r.output.slice(-300)}`);
    const png = Uint8Array.from(readFileSync(outPath));
    return { png, model: 'chatgpt-codex', quality: 'n/a', costUsd: 0 };
  }

  return { generate };
}
