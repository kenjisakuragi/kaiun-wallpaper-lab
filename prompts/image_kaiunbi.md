# 画像プロンプト：開運日版

スタイルガイドは `image_birthday.md` と共通（同じ STYLE_WORDS を使う）。

開運日の**種類ごとに1枚**を作り、同じ種類の開運日で使い回す（`docs/03` §1-3）。必要になったら2枚目以降を追加する。

## type ごとのモチーフ（初期案。人がレビューする）
| type | モチーフ（英語でプロンプトに入れる） | 基調色 |
| --- | --- | --- |
| ichiryumanbaibi | a single rice ear with golden light | 金・若草色 |
| tenshabi | a soft sunrise sky with light rays | 暁色 |
| toranohi | golden light particles flowing like a river | 金・琥珀 |
| minohi | a white flower with soft silver glow | 白・銀 |
| taian | a calm lake reflecting soft light | 水色 |
| shingetsu | a dark-blue night sky with a thin new moon | 藍 |
| mangetsu | a full moon over soft clouds | 月白 |

動物（虎・蛇など）や神仏・神社仏閣の意匠は描かない。

## テンプレート
```
A vertical smartphone lock-screen wallpaper.
{motif_en}, soft gradient background in {base_color_en}.
Keep the top 25% and bottom 15% as plain background.
Style: {STYLE_WORDS}.
No text, no numbers, no letters, no logos, no people, no animals, no real buildings, no religious symbols.
```
