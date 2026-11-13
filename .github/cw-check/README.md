# PR の自動チェック（簡易版）

`server` への PR を出すと、GitHub Actions（`.github/workflows/pr-check.yml`）が自動で動き、PR にコメントを1つ付けます。push し直すと、同じコメントが書き換わります。サーバーにはつながず、どこにもデプロイしません。

## 何を見るか

### ❌ エラー（チェックが失敗になる）

BP が読み込めなくなる、または動かなくなるものです。**この PR で新しく出たもの**だけを数えます（前からある問題では失敗になりません）。

- JSON として読めないファイル（コメントは BDS と同じく読み飛ばす）
- JS の構文エラー
- `import` の行き先のファイルが無い。大文字・小文字の違いも見る（Windows では動いても、サーバーの Linux では見つからない）
- `import` するモジュールが `manifest.json` の dependencies に無い
- エンティティの中で呼んでいるイベントやコンポーネントグループが定義されていない
- エンティティのイベントの中の `run_command`（今の BDS では使えず、イベントごと無効になる。`queue_command` を使う）
- エンティティ・アイテム・ブロックの identifier が2か所で定義されている

### ⚠️ コードの注意点（失敗にはしない）

- スクリプトの `triggerEvent` / `spawnEntity` / `new ItemStack` が、どこにも定義されていない `cw:` のものを指している
- `minecraft:spawn_egg_interaction` があるのに `minecraft:offspring` が無い（ログに ERROR が大量に出る）
- `entityItemDrop` の `ev.items` を `for...of` で回している（動かない）
- `applyKnockback` の古い4引数の形（黙って効かない）
- ルートテーブルのファイルが無い

### ⚠️ レビューで見てほしいところ（失敗にはしない）

PR で**足された行**を `watch.json` の言葉で拾います。問題があるとは限らないので、意図どおりかを人が確かめます。

- 貴重なアイテム（古代の残骸・ネザライト・ダイヤなど）、アイテムを増やす処理（`loot spawn`・`spawnItem`・`addItem` など）、確率・倍率、採掘のイベント、お金・スコア、組み立てたコマンド、`eval`、権限、ワールドに保存するデータ
- ドロップ・取引・レシピのファイル、CI の設定、`manifest.json` の変更
- **1つのスクリプトに「アイテムを増やす処理」と「貴重なアイテム・確率・採掘・お金」が両方あると、🚨 として一番上に出します**（ゴーストツルハシで古代の残骸が3倍になった件のような形）

拾いたい言葉を増やすときは `watch.json` に足してください。

## 手元で動かす

Node 20 以上があれば、依存なしで動きます。

```bash
# 今のフォルダ全体を調べる（エラーと注意点だけ）
node .github/cw-check/check.mjs --head .

# server との差で調べる（PR と同じ）
git worktree add ../cw-base origin/server
git diff origin/server...HEAD > ../pr.diff
node .github/cw-check/check.mjs --head . --base ../cw-base --diff ../pr.diff --summary ../summary.md
```

## できないこと

- ゲームの中での動きは確かめません。デバッグ鯖（`f/` ブランチ）で動かして、ログにエラーが出ていないかは自分で見てください
- 値が妥当か（倍率・確率・ドロップ数）は判断しません。これは次の段階（AI のレビュー）でやる予定です
