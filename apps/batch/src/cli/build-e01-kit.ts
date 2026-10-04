// E-01（Threads 手動投稿7日間テスト）でオーナーがスマホから使うページを組み立てる。
// 出力：out/e01/kit.html（Artifact として公開する。画像は data URI で埋め込む）
//   pnpm exec tsx apps/batch/src/cli/build-e01-kit.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { DATA_DIR, REPO_ROOT } from '../paths.ts';

type Post = { date: string; lead: string; body: string; text: string };
type Birthday = { date: string; color_name: string; keyword: string };

const OUT = join(REPO_ROOT, 'out', 'e01');
const posts = JSON.parse(readFileSync(join(OUT, 'posts_full.json'), 'utf8')) as Post[];
const birthdays = (parse(readFileSync(join(DATA_DIR, 'birthdays.yaml'), 'utf8')) as Birthday[]).map((b) => [b.date, b.color_name, b.keyword]);

const days = posts.map((p, i) => {
  const img = join(REPO_ROOT, 'out', 'images', 'birthday', `${p.date}_v1.jpg`);
  const b = birthdays.find((x) => x[0] === p.date);
  return {
    n: i + 1,
    date: p.date,
    label: `${Number(p.date.slice(0, 2))}月${Number(p.date.slice(3))}日`,
    color: b?.[1] ?? '',
    text: p.text,
    img: existsSync(img) ? `data:image/jpeg;base64,${readFileSync(img).toString('base64')}` : '',
  };
});

const DATA = JSON.stringify({ days, birthdays }).replace(/</g, '\\u003c');

const html = `<title>誕生色ポストキット</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<style>
/* レイアウト：1列のスマホ用ツール。上部タブ（投稿／返信／記録）で切り替え、各タブは1枚のカードが主役 */
:root {
  --bg: #f6f2f4; --surface: #ffffff; --ink: #2b1d24; --muted: #75636c; --line: #e6dbe0;
  --wine: #8e2f4f; --wine-soft: #f3e3e9; --gold: #a9853a; --ok: #2f7a55; --warn: #a3542b;
  --display: "Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --body: "Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #1b1418; --surface: #261c22; --ink: #f2e9ed; --muted: #b9a7b0; --line: #3a2c34;
  --wine: #e48aa8; --wine-soft: #3a2230; --gold: #d8b56a; --ok: #7fd1a6; --warn: #f0a37a; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #1b1418; --surface: #261c22; --ink: #f2e9ed; --muted: #b9a7b0; --line: #3a2c34;
  --wine: #e48aa8; --wine-soft: #3a2230; --gold: #d8b56a; --ok: #7fd1a6; --warn: #f0a37a; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.7; }
.wrap { max-width: 34rem; margin: 0 auto; padding-inline: 16px; padding-block: 12px 40px; display: grid; gap: 16px }
header h1 { font-family: var(--display); font-size: 1.5rem; margin: 0; text-wrap: balance; letter-spacing: .02em }
header p { margin: 2px 0 0; color: var(--muted); font-size: .85rem }
.tabs { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 2; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--bg); padding-block: 6px }
.tabs button { font: inherit; font-weight: 700; padding: 10px 0; border: 1px solid var(--line); background: var(--surface); color: var(--muted); border-radius: 999px; cursor: pointer }
.tabs button[aria-selected="true"] { background: var(--wine); border-color: var(--wine); color: var(--surface) }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: grid; gap: 12px; min-width: 0 }
.eyebrow { font-size: .72rem; letter-spacing: .12em; color: var(--gold); font-weight: 700 }
h2 { font-family: var(--display); font-size: 1.2rem; margin: 0; text-wrap: balance }
.days { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin }
.days button { flex: 0 0 auto; font: inherit; font-size: .82rem; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums }
.days button[aria-pressed="true"] { border-color: var(--wine); background: var(--wine-soft); color: var(--wine); font-weight: 700 }
.shot { width: 100%; max-width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 10px; background: var(--wine-soft); display: block }
.missing { aspect-ratio: 9/16; max-width: 100%; display: grid; place-items: center; border-radius: 10px; background: var(--wine-soft); color: var(--muted); text-align: center; padding: 16px }
.hint { font-size: .8rem; color: var(--muted); margin: 0 }
pre.text { white-space: pre-wrap; font-family: var(--body); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin: 0; font-size: .92rem }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center }
.btn { font: inherit; font-weight: 700; padding: 10px 16px; border-radius: 10px; border: 0; background: var(--wine); color: var(--surface); cursor: pointer }
.btn.ghost { background: transparent; color: var(--wine); border: 1px solid var(--wine) }
.status { font-size: .82rem; color: var(--ok); min-height: 1.2em }
ol.steps { margin: 0; padding-left: 1.2em; display: grid; gap: 2px; font-size: .88rem }
label { font-size: .82rem; color: var(--muted); display: grid; gap: 4px }
input, textarea { font: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); width: 100% }
input.big { font-size: 1.6rem; letter-spacing: .3em; text-align: center; font-family: var(--mono) }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px }
.reply { font-size: 1.05rem; background: var(--wine-soft); border-radius: 10px; padding: 12px }
.note-warn { color: var(--warn); font-size: .85rem; margin: 0 }
table { width: 100%; border-collapse: collapse; font-size: .82rem; font-variant-numeric: tabular-nums }
th, td { text-align: right; padding: 6px 4px; border-bottom: 1px solid var(--line) }
th:first-child, td:first-child { text-align: left }
.tablewrap { overflow-x: auto }
.kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px }
.kpi { background: var(--bg); border-radius: 10px; padding: 8px; text-align: center }
.kpi b { display: block; font-size: 1.3rem; font-family: var(--display); font-variant-numeric: tabular-nums }
.kpi span { font-size: .72rem; color: var(--muted) }
@media (prefers-reduced-motion: no-preference) { .tabs button, .days button { transition: background .15s } }
</style>

<div class="wrap">
  <header>
    <h1>誕生色ポストキット</h1>
    <p>Threads 手動投稿テスト（E-01・7日間）用。投稿 → リプに返信 → 夜に数字を記録。</p>
  </header>

  <nav class="tabs" role="tablist">
    <button role="tab" id="tab-post" aria-selected="true" data-tab="post">投稿</button>
    <button role="tab" id="tab-reply" aria-selected="false" data-tab="reply">返信</button>
    <button role="tab" id="tab-log" aria-selected="false" data-tab="log">記録</button>
  </nav>

  <section id="panel-post" class="card" role="tabpanel" aria-labelledby="tab-post">
    <div class="eyebrow">STEP 1 ・ 1日1本</div>
    <div class="days" id="days" aria-label="投稿する日"></div>
    <h2 id="post-title"></h2>
    <div id="post-image"></div>
    <p class="hint">画像を長押しして保存してください（1080×1920・文字なし）。</p>
    <pre class="text" id="post-text"></pre>
    <div class="row"><button class="btn" id="copy-post">本文をコピー</button><span class="status" id="copy-post-status" aria-live="polite"></span></div>
    <ol class="steps">
      <li>Threads で新規投稿を開き、保存した画像を1枚付ける</li>
      <li>コピーした本文を貼り付ける（ハッシュタグ・リンクは付けない）</li>
      <li>AI 情報のラベルを付けられる場合はオンにする</li>
      <li>朝7時ごろに投稿する（時刻をそろえると比べやすい）</li>
    </ol>
  </section>

  <section id="panel-reply" class="card" role="tabpanel" aria-labelledby="tab-reply" hidden>
    <div class="eyebrow">STEP 2 ・ 誕生日リプへのお返事</div>
    <h2>リプの4けたを入力</h2>
    <label for="md-input">リプに書かれた誕生日（例：0315、3/15、3月15日）
      <input id="md-input" class="big" inputmode="numeric" autocomplete="off" value="0315">
    </label>
    <div id="reply-out"></div>
    <div class="row"><button class="btn" id="copy-reply">返信文をコピー</button><button class="btn ghost" id="next-reply">別の言い回し</button><span class="status" id="copy-reply-status" aria-live="polite"></span></div>
    <p class="hint">返信文には月日の数字・リンク・ハッシュタグを入れていません。読み取れないリプには返信しません（仕様どおり）。1日に返すのは50件までにしてください。</p>
  </section>

  <section id="panel-log" class="card" role="tabpanel" aria-labelledby="tab-log" hidden>
    <div class="eyebrow">STEP 3 ・ 夜に1回</div>
    <h2>今日の数字を記録</h2>
    <p class="hint">Threads のインサイト（投稿の「…」→ インサイト）の数字を入れます。記録は Claude が読み取って PDCA に反映します。</p>
    <form id="log-form" class="grid2">
      <label for="f-date">日付<input id="f-date" type="date"></label>
      <label for="f-views">表示数<input id="f-views" type="number" min="0" inputmode="numeric"></label>
      <label for="f-replies">リプ数（全部）<input id="f-replies" type="number" min="0" inputmode="numeric"></label>
      <label for="f-bday">誕生日リプ数<input id="f-bday" type="number" min="0" inputmode="numeric"></label>
      <label for="f-follows">フォロー増<input id="f-follows" type="number" min="0" inputmode="numeric"></label>
      <label for="f-minutes">作業した分<input id="f-minutes" type="number" min="0" inputmode="numeric"></label>
      <label for="f-note" style="grid-column: 1 / -1">気づいたこと<textarea id="f-note" rows="2"></textarea></label>
      <div class="row" style="grid-column: 1 / -1"><button class="btn" type="submit" id="save-log">記録する</button><span class="status" id="log-status" aria-live="polite"></span></div>
    </form>
    <p class="note-warn" id="db-off" hidden>このページでは記録を保存できません（サインインしていないか、権限がありません）。数字はチャットで Claude に送ってください。</p>
    <div class="kpis" id="kpis"></div>
    <div class="tablewrap"><table id="log-table"><thead><tr><th>日付</th><th>表示</th><th>リプ</th><th>誕生日</th><th>フォロー</th><th>分</th></tr></thead><tbody></tbody></table></div>
    <p class="hint">判断の目安（7日後）：誕生日リプ10件以上＝成功、表示1,000以上でリプ0〜2件＝文面を変える、表示1,000未満＝期間を延ばす。</p>
  </section>
</div>

<script>
const DATA = ${DATA};

/* タブ */
const tabs = document.querySelectorAll('.tabs button');
function showTab(name) {
  tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  for (const t of ['post', 'reply', 'log']) document.getElementById('panel-' + t).hidden = t !== name;
  try { localStorage.setItem('tab', name); } catch (e) {}
}
tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

async function copy(text, statusEl) {
  try { await navigator.clipboard.writeText(text); statusEl.textContent = 'コピーしました'; }
  catch (e) { statusEl.textContent = '長押しで選択してコピーしてください'; }
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
}

/* 投稿 */
let dayIdx = 0;
const daysEl = document.getElementById('days');
DATA.days.forEach((d, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = (i < 7 ? '本番' : '予備') + (i < 7 ? i + 1 : i - 6) + '日目 ' + d.label;
  b.addEventListener('click', () => { dayIdx = i; renderPost(); });
  daysEl.appendChild(b);
});
function renderPost() {
  const d = DATA.days[dayIdx];
  [...daysEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === dayIdx)));
  document.getElementById('post-title').textContent = d.label + '生まれ ・ ' + d.color;
  const box = document.getElementById('post-image');
  box.textContent = '';
  if (d.img) { const im = new Image(); im.src = d.img; im.alt = d.label + '生まれの守護カラー待ち受け（' + d.color + '）'; im.className = 'shot'; box.appendChild(im); }
  else { const m = document.createElement('div'); m.className = 'missing'; m.textContent = 'この日の画像は生成中です。ページの更新をお待ちください。'; box.appendChild(m); }
  document.getElementById('post-text').textContent = d.text;
  try { localStorage.setItem('day', String(dayIdx)); } catch (e) {}
}
document.getElementById('copy-post').addEventListener('click', () => copy(DATA.days[dayIdx].text, document.getElementById('copy-post-status')));

/* 返信：月日パーサ（packages/core/src/monthDay.ts と同じ規則。年入り・候補が複数は失敗） */
const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function parseMD(input) {
  const t = input.normalize('NFKC');
  if (/\\d{5,}/.test(t) || /\\d+\\s*年/.test(t) || /\\d+\\s*\\/\\s*\\d+\\s*\\/\\s*\\d+/.test(t)) return null;
  const pats = [/(?<!\\d)(\\d{2})(\\d{2})(?!\\d)/g, /(?<![\\d/])(\\d{1,2})\\s*\\/\\s*(\\d{1,2})(?![\\d/])/g, /(?<!\\d)(\\d{1,2})\\s*月\\s*(\\d{1,2})(?!\\d)\\s*日?/g];
  const c = [];
  for (const re of pats) for (const m of t.matchAll(re)) c.push([+m[1], +m[2]]);
  if (c.length !== 1) return null;
  const [mo, d] = c[0];
  if (mo < 1 || mo > 12 || d < 1 || d > DIM[mo - 1]) return null;
  return String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
/* prompts/threads_replies.md のテンプレート（LINE 誘導は LINE 開設後に追加） */
const BODIES = [
  (c, k) => 'その日生まれさんの守護カラーは「' + c + '」。キーワードは「' + k + '」です。',
  (c, k) => '「' + c + '」があなたの守護カラー。今日は「' + k + '」を意識してみてね。',
  (c, k) => 'お誕生日の守護カラーは「' + c + '」でした。キーワードは「' + k + '」。',
  (c, k) => 'あなたの守護カラーは「' + c + '」。「' + k + '」の一日になりますように。',
  (c, k) => '守護カラー「' + c + '」、キーワード「' + k + '」をお届けします。',
];
const ADDS = ['待ち受けにすると毎日目に入るのでおすすめです。', '占い・おまじないとして楽しんでね。', 'リプありがとうございます。'];
let turn = 0;
try { turn = Number(localStorage.getItem('turn') || 0) || 0; } catch (e) {}
function replyText() {
  const md = parseMD(document.getElementById('md-input').value);
  if (!md) return null;
  const b = DATA.birthdays.find((x) => x[0] === md);
  if (!b) return null;
  let text = BODIES[turn % BODIES.length](b[1], b[2]);
  const add = ADDS[Math.floor(turn / BODIES.length) % ADDS.length];
  if (Array.from(text + add).length <= 80) text += add;
  return text;
}
function renderReply() {
  const out = document.getElementById('reply-out');
  const t = replyText();
  out.textContent = '';
  const p = document.createElement('p');
  p.className = t ? 'reply' : 'note-warn';
  p.textContent = t || '月日として読み取れません。このリプには返信しません。';
  out.appendChild(p);
}
document.getElementById('md-input').addEventListener('input', renderReply);
document.getElementById('next-reply').addEventListener('click', () => { turn++; try { localStorage.setItem('turn', String(turn)); } catch (e) {} renderReply(); });
document.getElementById('copy-reply').addEventListener('click', () => {
  const t = replyText();
  if (!t) return;
  copy(t, document.getElementById('copy-reply-status'));
  turn++; try { localStorage.setItem('turn', String(turn)); } catch (e) {}
});

/* 記録（db：log/<YYYY-MM-DD>） */
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
document.getElementById('f-date').value = today;
const F = ['views', 'replies', 'bday', 'follows', 'minutes'];
let db = null;
let rows = [];
function renderLog() {
  const tb = document.querySelector('#log-table tbody');
  tb.textContent = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const v of [r.date, r.views, r.replies, r.bday, r.follows, r.minutes]) { const td = document.createElement('td'); td.textContent = v ?? '–'; tr.appendChild(td); }
    tb.appendChild(tr);
  }
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const views = sum('views'), bday = sum('bday');
  const kp = document.getElementById('kpis');
  kp.textContent = '';
  for (const [v, l] of [[views.toLocaleString(), '表示の合計'], [bday, '誕生日リプ'], [views ? (bday / views * 100).toFixed(2) + '%' : '–', 'リプ率']]) {
    const d = document.createElement('div'); d.className = 'kpi';
    const b = document.createElement('b'); b.textContent = v; const s = document.createElement('span'); s.textContent = l;
    d.append(b, s); kp.appendChild(d);
  }
}
renderLog();
document.getElementById('log-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = document.getElementById('log-status');
  if (!db) { st.textContent = 'このページでは保存できません'; return; }
  const date = document.getElementById('f-date').value;
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) { st.textContent = '日付を選んでください'; return; }
  const body = { date, note: document.getElementById('f-note').value.slice(0, 500), updatedAt: new Date().toISOString() };
  for (const k of F) { const v = document.getElementById('f-' + k).value; body[k] = v === '' ? null : Math.max(0, Math.floor(Number(v))); }
  try { await db.doc('log/' + date).set(body); st.textContent = date + ' を記録しました'; }
  catch (err) { st.textContent = '保存できませんでした（' + (err && err.code || 'error') + '）'; }
});
(async () => {
  try { db = await window.claude?.use?.('db'); } catch (e) { db = null; }
  if (!db) { document.getElementById('db-off').hidden = false; document.getElementById('save-log').disabled = true; return; }
  db.collection('log').orderBy('date', 'desc').limit(60).onSnapshot((snap) => { rows = snap.docs.map((d) => d.data()); renderLog(); }, () => {});
})();

/* 初期表示 */
try { const d = Number(localStorage.getItem('day')); if (d >= 0 && d < DATA.days.length) dayIdx = d; } catch (e) {}
renderPost();
renderReply();
try { const t = localStorage.getItem('tab'); if (t) showTab(t); } catch (e) {}
</script>
`;

writeFileSync(join(OUT, 'kit.html'), html, 'utf8');
process.stdout.write(`out/e01/kit.html（${days.filter((d) => d.img).length}/${days.length} 枚の画像を埋め込み、${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB）\n`);
