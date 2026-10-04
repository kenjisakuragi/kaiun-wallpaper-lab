# 画像プロンプト：アファメーション版

スタイルガイドは `image_birthday.md` と共通（同じ STYLE_WORDS を使う）。
言葉は画像に入れず、投稿の本文に書く（`docs/03` §2-1）。12枚で開始し、投稿ごとに使い回す（`docs/03` §1-4）。
題材（情景と色）は `data/affirmation_images.yaml`。

## テンプレート
```
A vertical smartphone lock-screen wallpaper.
A calm, hopeful scene: {scene_en}. Soft gradient background based on {color_hex}.
Keep the top 25% and bottom 15% as plain background.
Style: {STYLE_WORDS}.
No text, no numbers, no letters, no logos, no people, no animals, no real buildings, no religious symbols.
```
