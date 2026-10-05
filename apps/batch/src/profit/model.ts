// 利益モデル（ハーネス：売上ではなく「広告費控除後の限界利益」を見る）。
// 導線：SNS 投稿 → プロフィールのリンク → LINE 友だち → AI チャット占い（体験 → 課金）。
// 値はすべて「測定済み / 仮定 / 未確認」を持たせ、未確認が1つでも要る出力は null（＝判定不能）にする。

import { z } from 'zod';

export const ValueStatus = z.enum(['measured', 'assumed', 'unknown']);
export type ValueStatus = z.infer<typeof ValueStatus>;

const Value = z.object({
  value: z.number().nullable(),
  status: ValueStatus,
  /** 出典・根拠（測定なら期間とデータ、仮定なら理由） */
  source: z.string().default(''),
});
export type Value = z.infer<typeof Value>;

/** 1か月あたりの入力。率は 0〜1、金額は円。 */
export const AssumptionsSchema = z.object({
  scenario: z.string(),
  inputs: z.object({
    /** プロフィールのリンク（/go/*）のクリック数 */
    linkClicks: Value,
    /** クリックのうち LINE 友だち追加に至る割合 */
    lineAddRate: Value,
    /** LINE 友だちのうち AI チャットのリンクを開く割合 */
    chatClickRate: Value,
    /** AI チャットを開いた人のうち会員登録する割合 */
    signupRate: Value,
    /** 登録者のうち30日以内に課金する割合 */
    payerRate: Value,
    /** 課金者1人あたりの30日間の売上（税込、返金前） */
    revenuePerPayer: Value,
    /** 返金率（売上に対する割合） */
    refundRate: Value,
    /** 決済手数料率 */
    paymentFeeRate: Value,
    /** AI の1通あたり原価（円） */
    aiCostPerMessage: Value,
    /** 1円あたりの付与 pt ÷ 1通の pt（＝1円で何通読めるか。1pt=1円・1通20pt なら 0.05） */
    messagesPerYen: Value,
    /** 登録者1人が無料で使う通数（お試し＋登録特典） */
    freeMessagesPerSignup: Value,
    /** 広告費（月） */
    adSpend: Value,
    /** この導線のための固定費（月：LINE プラン、ドメインなど） */
    fixedCost: Value,
    /** 限界利益のうちオーナー側に残る割合（JV の配分） */
    ownerShare: Value,
    /** 運用にかかる人の時間（月・時間） */
    humanHours: Value,
  }),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;
type Key = keyof Assumptions['inputs'];

export type Line = { key: string; label: string; value: number | null; missing: Key[] };

export type ProfitResult = {
  scenario: string;
  lines: Line[];
  /** 判定に必要なのに未確認の入力 */
  unknownInputs: Key[];
  /** 仮定の入力（測定で置き換えたい順に見る） */
  assumedInputs: Key[];
};

/** 未確認（null）が混じれば null を返す小さな計算器 */
function calc(inputs: Assumptions['inputs']) {
  const v = (k: Key): { n: number | null; missing: Key[] } => {
    const x = inputs[k];
    return x.status === 'unknown' || x.value === null ? { n: null, missing: [k] } : { n: x.value, missing: [] };
  };
  type R = { n: number | null; missing: Key[] };
  const op = (f: (...a: number[]) => number, ...rs: R[]): R => ({
    n: rs.some((r) => r.n === null) ? null : f(...rs.map((r) => r.n as number)),
    missing: [...new Set(rs.flatMap((r) => r.missing))],
  });
  return { v, op };
}

export function evaluate(a: Assumptions): ProfitResult {
  const { v, op } = calc(a.inputs);
  const mul = (...xs: number[]) => xs.reduce((s, x) => s * x, 1);

  const lineFriends = op(mul, v('linkClicks'), v('lineAddRate'));
  const chatVisitors = op(mul, lineFriends, v('chatClickRate'));
  const signups = op(mul, chatVisitors, v('signupRate'));
  const payers = op(mul, signups, v('payerRate'));
  const gross = op(mul, payers, v('revenuePerPayer'));
  const refunds = op(mul, gross, v('refundRate'));
  const net = op((g, r) => g - r, gross, refunds);
  const fees = op(mul, gross, v('paymentFeeRate'));
  const paidMessages = op(mul, gross, v('messagesPerYen'));
  const aiPaid = op(mul, paidMessages, v('aiCostPerMessage'));
  const aiFree = op(mul, signups, v('freeMessagesPerSignup'), v('aiCostPerMessage'));
  const contributionBeforeAds = op((n, f, p, fr) => n - f - p - fr, net, fees, aiPaid, aiFree);
  const contributionAfterAds = op((c, ad) => c - ad, contributionBeforeAds, v('adSpend'));
  const ownerContribution = op(mul, contributionAfterAds, v('ownerShare'));
  const profitAfterFixed = op((c, f) => c - f, ownerContribution, v('fixedCost'));
  const perFriend = op((c, f) => (f === 0 ? 0 : c / f), contributionBeforeAds, lineFriends);
  const ownerPerFriend = op((c, s) => c * s, perFriend, v('ownerShare'));
  const perHour = op((p, h) => (h === 0 ? 0 : p / h), profitAfterFixed, v('humanHours'));

  const line = (key: string, label: string, r: { n: number | null; missing: Key[] }): Line => ({ key, label, value: r.n, missing: r.n === null ? r.missing : [] });
  const lines: Line[] = [
    line('lineFriends', 'LINE 友だち増（人）', lineFriends),
    line('chatVisitors', 'AI チャット訪問（人）', chatVisitors),
    line('signups', 'AI チャット登録（人）', signups),
    line('payers', '課金者（人）', payers),
    line('grossRevenue', '売上（返金前・円）', gross),
    line('netRevenue', '売上（返金後・円）', net),
    line('paymentFees', '決済手数料（円）', fees),
    line('aiCostPaid', 'AI 原価：有料分（円）', aiPaid),
    line('aiCostFree', 'AI 原価：無料体験分（円）', aiFree),
    line('contributionBeforeAds', '限界利益：広告費控除前（円）', contributionBeforeAds),
    line('contributionAfterAds', '限界利益：広告費控除後（円）', contributionAfterAds),
    line('ownerContribution', 'うちオーナー側（円）', ownerContribution),
    line('profitAfterFixed', '固定費控除後（円）', profitAfterFixed),
    line('valuePerLineFriend', 'LINE 友だち1人あたり限界利益（円）＝獲得単価の上限の目安', perFriend),
    line('ownerValuePerLineFriend', '同・オーナー側（円）', ownerPerFriend),
    line('profitPerHour', '人の作業1時間あたり（円）', perHour),
  ];
  const keys = Object.keys(a.inputs) as Key[];
  return {
    scenario: a.scenario,
    lines,
    unknownInputs: keys.filter((k) => a.inputs[k].status === 'unknown' || a.inputs[k].value === null),
    assumedInputs: keys.filter((k) => a.inputs[k].status === 'assumed' && a.inputs[k].value !== null),
  };
}

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export function renderReport(results: ProfitResult[], meta: { generatedAt: string; file: string }): string {
  const head = `# 利益の点検（profit-audit）\n\n- 作成：${meta.generatedAt}\n- 入力：${meta.file}\n- 数字は月あたりの試算。「—」は未確認の入力があり判定不能。実績ではない。\n`;
  const sections = results.map((r) => {
    const rows = r.lines.map((l) => `| ${l.label} | ${l.value === null ? '—' : yen(l.value)} | ${l.missing.join(', ')} |`).join('\n');
    return `\n## シナリオ：${r.scenario}\n\n| 項目 | 値 | 不足している入力 |\n| --- | ---: | --- |\n${rows}\n\n- 未確認の入力：${r.unknownInputs.join(', ') || 'なし'}\n- 仮定の入力（測定で置き換えたい）：${r.assumedInputs.join(', ') || 'なし'}\n`;
  });
  return head + sections.join('');
}
