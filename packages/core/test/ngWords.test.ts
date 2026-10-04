import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNgWords, findNgWords, parseNgList } from '../src/ngWords.ts';

const NG_FILE = join(import.meta.dirname, '..', '..', '..', 'data', 'ng_words.txt');
const entries = parseNgList(readFileSync(NG_FILE, 'utf8'));
const words = entries.filter((e) => e.kind === 'word').map((e) => e.source);

describe('NG ワード検査（docs/07 M1 完了条件）', () => {
  it('data/ng_words.txt を読める（語と正規表現）', () => {
    expect(words.length).toBeGreaterThan(10);
    expect(entries.some((e) => e.kind === 'regex')).toBe(true);
  });

  it.each(words)('%j を含む文は block モードで reject', (w) => {
    const r = checkNgWords(`今日の待ち受けは${w}おすすめです`, entries, 'block');
    expect(r.action).toBe('reject');
    expect(r.hits.map((h) => h.source)).toContain(w);
  });

  it.each([
    ['全角数字・記号', '１００％当たる待ち受け', '100%'],
    ['カタカナ表記', '必ズ届きます', '必ず'],
    ['半角カナ', 'ｽｸﾞ削除してください', 'すぐ削除'],
    ['空白をはさむ', '絶 対 に見てね', '絶対'],
    ['正規表現（全角数字）', '３秒見るだけで変わる', 're:\\d+秒(以上)?見る(だけ)?で'],
    ['正規表現', '10秒以上見るで', 're:\\d+秒(以上)?見る(だけ)?で'],
  ])('揺れを正規化して検出：%s', (_label, text, source) => {
    const r = checkNgWords(text, entries, 'block');
    expect(r.action).toBe('reject');
    expect(r.hits.map((h) => h.source)).toContain(source);
  });

  it('NG ワードを含まない文は通る', () => {
    const text = '今日3月15日生まれさんの守護カラー待ち受け。お守りがわりにどうぞ。※画像はAIで作成しています';
    expect(findNgWords(text, entries)).toEqual([]);
    expect(checkNgWords(text, entries, 'block')).toEqual({ action: 'pass', hits: [] });
  });
});

describe('NG_WORD_MODE（docs/09 #16：送信を止めない）', () => {
  const text = '必ず叶います';

  it('warn は該当語を返すが pass', () => {
    const r = checkNgWords(text, entries, 'warn');
    expect(r.action).toBe('pass');
    expect(r.hits.map((h) => h.source)).toEqual(expect.arrayContaining(['必ず', '叶います']));
  });

  it('off は検査しない', () => {
    expect(checkNgWords(text, entries, 'off')).toEqual({ action: 'pass', hits: [] });
  });

  it('block は reject', () => {
    expect(checkNgWords(text, entries, 'block').action).toBe('reject');
  });
});

describe('parseNgList', () => {
  it('空行と # コメントを無視し、CRLF も読める', () => {
    const list = parseNgList('# コメント\r\n\r\nテスト語\r\nre:a+b\r\n');
    expect(list.map((e) => e.kind)).toEqual(['word', 'regex']);
  });

  it('カタカナの NG 語はひらがなの文にも当たる', () => {
    expect(findNgWords('さいきょうの待ち受け', parseNgList('サイキョウ'))).toHaveLength(1);
  });
});
