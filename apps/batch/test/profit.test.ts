import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { type Assumptions, AssumptionsSchema, evaluate, renderReport } from '../src/profit/model.ts';
import { REPO_ROOT } from '../src/paths.ts';

const m = (value: number) => ({ value, status: 'measured' as const, source: 't' });
const base = (): Assumptions => ({
  scenario: 't',
  inputs: {
    linkClicks: m(1000),
    lineAddRate: m(0.5),
    chatClickRate: m(0.2),
    signupRate: m(0.5),
    payerRate: m(0.1),
    revenuePerPayer: m(3000),
    refundRate: m(0.1),
    paymentFeeRate: m(0.05),
    aiCostPerMessage: m(2),
    messagesPerYen: m(0.05),
    freeMessagesPerSignup: m(10),
    adSpend: m(1000),
    fixedCost: m(500),
    ownerShare: m(0.5),
    humanHours: m(10),
  },
});
const get = (a: Assumptions, key: string) => evaluate(a).lines.find((l) => l.key === key)?.value;

describe('利益モデル（広告費控除後の限界利益）', () => {
  it('導線の人数と金額を手計算どおりに出す', () => {
    const a = base();
    // 1000×0.5=500 友だち → ×0.2=100 訪問 → ×0.5=50 登録 → ×0.1=5 課金 → ×3000=15,000 円
    expect(get(a, 'lineFriends')).toBe(500);
    expect(get(a, 'signups')).toBe(50);
    expect(get(a, 'payers')).toBeCloseTo(5);
    expect(get(a, 'grossRevenue')).toBeCloseTo(15000);
    expect(get(a, 'netRevenue')).toBeCloseTo(13500); // 返金10%
    expect(get(a, 'paymentFees')).toBeCloseTo(750); // 返金前売上×5%
    expect(get(a, 'aiCostPaid')).toBeCloseTo(1500); // 15,000円×0.05通×2円
    expect(get(a, 'aiCostFree')).toBeCloseTo(1000); // 50人×10通×2円
    expect(get(a, 'contributionBeforeAds')).toBeCloseTo(10250);
    expect(get(a, 'contributionAfterAds')).toBeCloseTo(9250);
    expect(get(a, 'ownerContribution')).toBeCloseTo(4625);
    expect(get(a, 'profitAfterFixed')).toBeCloseTo(4125);
    expect(get(a, 'valuePerLineFriend')).toBeCloseTo(20.5);
    expect(get(a, 'profitPerHour')).toBeCloseTo(412.5);
  });

  it('未確認の入力があれば、それに依存する出力だけ判定不能（null）にし、理由を残す', () => {
    const a = base();
    a.inputs.ownerShare = { value: null, status: 'unknown', source: '配分未確認' };
    const r = evaluate(a);
    expect(r.unknownInputs).toEqual(['ownerShare']);
    expect(get(a, 'contributionAfterAds')).toBeCloseTo(9250);
    const owner = r.lines.find((l) => l.key === 'ownerContribution');
    expect(owner?.value).toBeNull();
    expect(owner?.missing).toEqual(['ownerShare']);
  });

  it('status が unknown なら値が入っていても使わない（推測を事実として埋めない）', () => {
    const a = base();
    a.inputs.aiCostPerMessage = { value: 2, status: 'unknown', source: '' };
    expect(get(a, 'contributionBeforeAds')).toBeNull();
    expect(get(a, 'grossRevenue')).toBeCloseTo(15000);
  });

  it('無料体験の AI 原価が大きいと、課金があっても限界利益はマイナスになりうる', () => {
    const a = base();
    a.inputs.freeMessagesPerSignup = m(28);
    a.inputs.aiCostPerMessage = m(12);
    expect(get(a, 'contributionBeforeAds')).toBeLessThan(0);
  });

  it('仮定の入力を一覧にする（測定で置き換える順の手がかり）', () => {
    const a = base();
    a.inputs.payerRate = { value: 0.1, status: 'assumed', source: '仮' };
    expect(evaluate(a).assumedInputs).toEqual(['payerRate']);
  });

  it('レポートは未確認を「—」で表示し、実績ではないと明記する', () => {
    const a = base();
    a.inputs.ownerShare = { value: null, status: 'unknown', source: '' };
    const md = renderReport([evaluate(a)], { generatedAt: '2026-10-06T00:00:00+09:00', file: 'x.yaml' });
    expect(md).toContain('実績ではない');
    expect(md).toMatch(/うちオーナー側（円） \| — \| ownerShare/);
  });

  it('書式例のファイルは形式が正しい', () => {
    const raw = parse(readFileSync(join(REPO_ROOT, 'data', 'profit-assumptions.example.yaml'), 'utf8'));
    expect(z.array(AssumptionsSchema).safeParse(raw).success).toBe(true);
  });
});
