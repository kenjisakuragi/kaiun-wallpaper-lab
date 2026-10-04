# 開運日カレンダー

- 1行1日。複数の開運日が重なる日は行を分ける。
- `type` の値：`ichiryumanbaibi`（一粒万倍日）/ `tenshabi`（天赦日）/ `toranohi`（寅の日）/ `minohi`（巳の日）/ `taian`（大安）/ `shingetsu`（新月）/ `mangetsu`（満月）
- `source_url`：確認に使った暦サイト・暦書のページ。空欄の行はバッチが読み込まない。
- `checked_by`：入力・確認した人のイニシャル。
- 選日は流派や暦の扱いで差が出るため、自動計算はしない。新月・満月も出典（国立天文台など）を付ける。

例：
```
date,type,source_url,checked_by
2026-10-10,ichiryumanbaibi,https://example.com/koyomi/2026-10,KY
```
