# 画像プロンプト：誕生日版

## スタイルガイド（全画像共通・M3 の試作後に人が確定する）
- 縦長のスマホ待ち受け。上部25%と下部15%は背景のみ（時計とアイコンが重なるため）。
- 中央やや下に主役のモチーフを1つ。周囲に柔らかい光の粒。
- 守護カラーを基調にした淡いグラデーション背景。
- 文字・数字・ロゴ・人物・実在の建物や寺社・特定宗教のシンボルは描かない。
- 統一感のため、画風の指定語（例：やわらかい水彩、透明感、パステル）はこのファイルで固定し、日ごとに変えるのは色とモチーフだけ。

## テンプレート
```
A vertical smartphone lock-screen wallpaper.
Soft gradient background based on {color_hex} ({color_name}).
Main motif: {motif_en}, placed in the lower-middle area as the only main subject, gently glowing, surrounded by small soft light particles.
Keep the top 25% and bottom 15% as plain background.
Style: {STYLE_WORDS}.
No text, no numbers, no letters, no logos, no people, no real buildings, no religious symbols.
```
- `{motif_en}` は `birthdays.yaml` の motif を英訳したもの（変換表を `data/motif_en.yaml` に持つ。冠詞・複数形込みで書くため、テンプレート側では「A single」を付けない）。
- `{STYLE_WORDS}` はスタイル確定後にここへ記入する。
