import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalDb } from '@kaiun/client-d1';
import { createMemoryStorage } from '@kaiun/client-r2';
import { readMigrationStatements } from '@kaiun/db';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertBirthdaysReviewed } from '../src/data/reviewGate.ts';
import { BudgetExceededError, type GenerateDeps, type ImageGenerator, planImages, runPlan } from '../src/images/generate.ts';
import { FULL_SIZE, PREVIEW_SIZE, processImage } from '../src/images/process.ts';
import { buildJobs, extractBlock, fillTemplate } from '../src/images/prompts.ts';
import { approvedImage } from '../src/images/repo.ts';
import { applyApprovals, writeReviewPage } from '../src/images/review.ts';
import { DATA_DIR } from '../src/paths.ts';

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#f4b6c2' } }).png().toBuffer();
const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

function fakeGenerator(opts: { cost?: number; failTimes?: Map<string, number>; size?: [number, number]; concurrency?: number } = {}) {
  const calls: string[] = [];
  const failures = opts.failTimes ?? new Map<string, number>();
  const g: ImageGenerator = {
    name: opts.cost ? 'openai' : 'codex',
    concurrency: opts.concurrency ?? 1,
    costUsdPerImage: opts.cost ?? 0,
    secondsPerImage: 120,
    async generate(_prompt, name) {
      calls.push(name);
      const left = failures.get(name.replace(/_v\d+$/, '')) ?? 0;
      if (left > 0) {
        failures.set(name.replace(/_v\d+$/, ''), left - 1);
        throw new Error('temporary failure');
      }
      const [w, h] = opts.size ?? [1024, 1536];
      return { png: new Uint8Array(await png(w, h)), model: opts.cost ? 'gpt-image-2' : 'chatgpt-codex', quality: 'n/a', costUsd: opts.cost ?? 0 };
    },
  };
  return { g, calls };
}

let tmp: string;
let db: ReturnType<typeof createLocalDb>;
const storage = () => createMemoryStorage('https://img.example.com');
const deps = (over: Partial<GenerateDeps> = {}): GenerateDeps => ({
  db,
  storage: storage(),
  generator: fakeGenerator().g,
  randomPrefix: 'rnd12345',
  log: silentLog,
  localOutDir: join(tmp, 'images'),
  now: () => new Date('2026-10-04T03:00:00Z'),
  ...over,
});

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kaiun-img-'));
  db = createLocalDb(':memory:', readMigrationStatements().flatMap((m) => m.statements));
});
afterEach(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('指示文の組み立て', () => {
  it('テンプレートと STYLE_WORDS を md から読み、変数を埋める', () => {
    const md = '## テンプレート\n```\nHello {name}\n```\n';
    expect(fillTemplate(extractBlock(md, 'テンプレート'), { name: 'X' })).toBe('Hello X');
    expect(() => fillTemplate('{missing}', {})).toThrow(/missing/);
  });

  it('誕生日版：その日の色・モチーフ英訳・画風が入り、文字を描かない指示がある', () => {
    const [job] = buildJobs('birthday', { from: '03-01', to: '03-01' });
    expect(job?.key).toBe('03-01');
    expect(job?.prompt).toContain('#EEB4BE');
    expect(job?.prompt).toContain('cherry blossom petals');
    expect(job?.prompt).toContain('soft watercolor');
    expect(job?.prompt).toContain('No text');
    expect(job?.prompt).not.toMatch(/\{[A-Za-z_]+\}/);
    expect(job?.promptHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('初回の枚数：誕生日366・開運日4・アファメーション12・共通1（docs/03 §1-5）', () => {
    expect(buildJobs('birthday')).toHaveLength(366);
    expect(buildJobs('kaiunbi').map((j) => j.key)).toEqual(['tenshabi', 'ichiryumanbaibi', 'shingetsu', 'mangetsu']);
    expect(buildJobs('affirmation')).toHaveLength(12);
    expect(buildJobs('common').map((j) => j.key)).toEqual(['v1']);
    for (const kind of ['kaiunbi', 'affirmation', 'common'] as const) {
      for (const j of buildJobs(kind)) expect(j.prompt).not.toMatch(/\{[A-Za-z_]+\}/);
    }
  });

  it('--keys で絞れる', () => {
    expect(buildJobs('affirmation', { keys: ['a003', 'a010'] }).map((j) => j.key)).toEqual(['a003', 'a010']);
  });
});

describe('画像の整形（docs/07 M3：生成サイズが違っても 1080×1920 とプレビュー用ができる）', () => {
  it.each([
    [1024, 1536],
    [1024, 1024],
    [1536, 1024],
    [1200, 2000],
  ])('%i×%i → 1080×1920 と 270×480 の JPEG', async (w, h) => {
    const { full, preview } = await processImage(new Uint8Array(await png(w, h)));
    const mf = await sharp(full).metadata();
    const mp = await sharp(preview).metadata();
    expect([mf.width, mf.height, mf.format]).toEqual([FULL_SIZE.width, FULL_SIZE.height, 'jpeg']);
    expect([mp.width, mp.height, mp.format]).toEqual([PREVIEW_SIZE.width, PREVIEW_SIZE.height, 'jpeg']);
  });
});

describe('生成（冪等・リトライ・予算）', () => {
  const jobs = () => buildJobs('affirmation', { keys: ['a001', 'a002', 'a003'] });

  it('dry-run 相当の計画：枚数・推定時間（codex）・推定コスト（openai）', async () => {
    const codexPlan = await planImages(deps(), jobs());
    expect(codexPlan.toGenerate).toHaveLength(3);
    expect(codexPlan.estimatedCostUsd).toBe(0);
    expect(codexPlan.estimatedMinutes).toBe(6); // 3枚 × 120秒（テスト用の生成器）
    const apiPlan = await planImages(deps({ generator: fakeGenerator({ cost: 0.048, concurrency: 3 }).g }), jobs());
    expect(apiPlan.estimatedCostUsd).toBeCloseTo(0.144);
    expect(apiPlan.estimatedMinutes).toBe(2);
  });

  it('生成→2サイズを R2 に置き→images に generated で記録。2回実行しても再生成しない', async () => {
    const st = storage();
    const { g, calls } = fakeGenerator();
    const d = deps({ storage: st, generator: g });
    const r1 = await runPlan(d, await planImages(d, jobs()));
    expect(r1.generated).toHaveLength(3);
    expect(r1.failed).toEqual([]);
    expect([...st.objects.keys()].sort()).toContain('images/rnd12345/affirmation/a001_v1.jpg');
    expect([...st.objects.keys()]).toContain('images/rnd12345/affirmation/a001_v1_preview.jpg');
    expect(r1.generated[0]).toMatchObject({ status: 'generated', version: 1, model: 'chatgpt-codex', cost_usd: 0, created_at: '2026-10-04T12:00:00+09:00' });
    expect(r1.generated[0]?.r2_url_full).toBe('https://img.example.com/images/rnd12345/affirmation/a001_v1.jpg');
    expect(existsSync(join(tmp, 'images', 'affirmation', 'a001_v1_preview.jpg'))).toBe(true);

    const plan2 = await planImages(d, jobs());
    expect(plan2.toGenerate).toEqual([]);
    expect(plan2.skipped).toHaveLength(3);
    const r2 = await runPlan(d, plan2);
    expect(r2.generated).toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('rejected は version+1 で作り直す。--force は承認済みでも version+1', async () => {
    const d = deps();
    await runPlan(d, await planImages(d, jobs()));
    await applyApprovals(db, 'kind,key,version,decision\naffirmation,a001,1,rejected\naffirmation,a002,1,approved\n');
    const plan = await planImages(d, jobs());
    expect(plan.toGenerate.map((j) => `${j.key}_v${j.version}`)).toEqual(['a001_v2']);
    const forced = await planImages(d, jobs(), { force: true });
    expect(forced.toGenerate.map((j) => `${j.key}_v${j.version}`)).toEqual(['a001_v2', 'a002_v2', 'a003_v2']);
  });

  it('一時的な失敗は最大2回まで再試行。3回失敗した1枚はスキップして記録し、残りは続ける', async () => {
    const failTimes = new Map([
      ['affirmation_a001', 2],
      ['affirmation_a002', 3],
    ]);
    const { g, calls } = fakeGenerator({ failTimes });
    const d = deps({ generator: g });
    const r = await runPlan(d, await planImages(d, jobs()));
    expect(r.generated.map((x) => x.key).sort()).toEqual(['a001', 'a003']);
    expect(r.failed).toEqual([{ kind: 'affirmation', key: 'a002', error: 'temporary failure' }]);
    expect(calls.filter((c) => c.startsWith('affirmation_a002'))).toHaveLength(3);
  });

  it('費用のかかる経路は、予算を超えるなら開始前に止める', async () => {
    const d = deps({ generator: fakeGenerator({ cost: 0.05 }).g, budgetUsd: 0.1 });
    await expect(runPlan(d, await planImages(d, jobs()))).rejects.toBeInstanceOf(BudgetExceededError);
    const d2 = deps({ generator: fakeGenerator({ cost: 0.05 }).g, budgetUsd: 1 });
    const r = await runPlan(d2, await planImages(d2, jobs()));
    expect(r.generated.reduce((s, x) => s + x.cost_usd, 0)).toBeCloseTo(0.15);
  });

  it('--limit で試作の枚数を絞れる', async () => {
    expect((await planImages(deps(), buildJobs('birthday'), { limit: 20 })).toGenerate).toHaveLength(20);
  });
});

describe('レビューと承認（docs/07 M3）', () => {
  it('承認待ちを HTML と記入用 CSV に出し、approvals.csv で approved/rejected を反映。未承認は投稿に使わない', async () => {
    const d = deps();
    await runPlan(d, await planImages(d, buildJobs('kaiunbi')));
    expect(await approvedImage(db, 'kaiunbi', 'tenshabi')).toBeUndefined();

    const review = await writeReviewPage(db, join(tmp, 'review'), join(tmp, 'images'), new Map([['kaiunbi:tenshabi', '天赦日 <test>']]));
    expect(review.count).toBe(4);
    const html = readFileSync(review.htmlPath, 'utf8');
    expect(html).toContain('承認待ち 4 枚');
    expect(html).toContain('../images/kaiunbi/tenshabi_v1_preview.jpg');
    expect(html).toContain('天赦日 &lt;test&gt;');
    expect(readFileSync(join(tmp, 'review', 'approvals_template.csv'), 'utf8')).toContain('kaiunbi,tenshabi,1,approved');

    const r = await applyApprovals(db, 'kind,key,version,decision\nkaiunbi,tenshabi,1,approved\nkaiunbi,mangetsu,1,rejected\nkaiunbi,shingetsu,9,approved\nkaiunbi,x,1,maybe\n');
    expect(r.applied).toBe(2);
    expect(r.unchanged).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect((await approvedImage(db, 'kaiunbi', 'tenshabi'))?.version).toBe(1);
    expect(await approvedImage(db, 'kaiunbi', 'mangetsu')).toBeUndefined();

    // 承認済みは rejected に戻さない（前進のみ）
    const again = await applyApprovals(db, 'kind,key,version,decision\nkaiunbi,tenshabi,1,rejected\n');
    expect(again.applied).toBe(0);
    expect((await writeReviewPage(db, join(tmp, 'review'))).count).toBe(2);
  });

  it('approvals.csv のヘッダー違いはエラー', async () => {
    expect((await applyApprovals(db, 'a,b\n')).errors).toHaveLength(1);
  });
});

describe('本番生成のゲート（M2 から継続）', () => {
  it('誕生日版は birthdays.reviewed がなければ止まる', () => {
    const dir = join(tmp, 'data');
    cpSync(DATA_DIR, dir, { recursive: true });
    rmSync(join(dir, 'birthdays.reviewed'), { force: true });
    expect(() => assertBirthdaysReviewed(dir)).toThrow();
    writeFileSync(join(dir, 'birthdays.reviewed'), '');
    expect(() => assertBirthdaysReviewed(dir)).not.toThrow();
  });
});
