# キャプション生成：Instagram リール

## 入力
- theme: birthday | kaiunbi | affirmation
- date_label: 例「3月15日生まれ」「10月10日 一粒万倍日」「今日のアファメーション」
- affirmation: theme=affirmation のときの言葉（`data/affirmations.yaml`）
- color_name, motif, keyword
- recent_captions: 直近90日の Instagram キャプション（重複回避の参考）
- threads_text: 同じ日の Threads 本文（同じ文にしないための参考）

## 指示
- 80〜200字。用途→守護カラーとモチーフの一言→導線→定型文→ハッシュタグ3〜5個。
- 効果を断定しない、不安をあおらない、健康効果を書かない（docs/08 の NG ワード）。
- 導線：「誕生日だけの1枚はプロフィールのリンクのLINEで受け取れます」
- 定型文：「※画像はAIで作成しています／占い・おまじないとして楽しんでください」
- threads_text・recent_captions と同じ言い回しを避ける。
- 出力はキャプション本文のみ。
