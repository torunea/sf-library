# SF LIBRARY

SFの読書記録・作品間リンク管理Webアプリ。
Google Sheets をデータソースとし、GitHub Pages でホスティングします。

---

## ファイル構成

```
sf-library/
├── index.html
├── styles/
│   ├── base.css         # 変数・リセット・アニメーション
│   ├── layout.css       # ヘッダー・サイドバー・パネル
│   └── components.css   # カード・メモ・リンク・モーダル
├── src/
│   ├── config.js        # GAS URL・定数設定 ← ここを編集
│   ├── data.js          # GASとの通信・キャッシュ
│   ├── store.js         # 状態管理
│   ├── main.js          # アプリ起動
│   ├── views/
│   │   ├── list.js      # 一覧ビュー
│   │   ├── detail.js    # 詳細パネル
│   │   └── graph.js     # グラフビュー（遅延ロード）
│   └── ui/
│       ├── modal.js     # リンク追加モーダル
│       └── toast.js     # 通知
└── gas/
    └── Code.gs          # GASバックエンド
```

---

## セットアップ手順

### 1. スプレッドシートを用意する

#### SF_Library_Master（読み取り専用）

**Books シート**（1行目はヘッダー）
```
id | title_jp | title_orig | author_id | author_name | publisher | year_jp | synopsis | genre_tags | is_anthology | is_read
```
- `genre_tags` はセミコロン区切り（例: `サイバーパンク;AI・意識`）
- `is_anthology` / `is_read` は `TRUE` / `FALSE`

**Stories シート**（短編集の各話）
```
id | book_id | order | title_jp | title_orig
```

#### SF_Library_UserData（読み書き）

**Memos シート**
```
id | book_id | story_id | text | tags | created_at | updated_at
```

**Links シート**
```
id | from_book_id | from_story_id | to_book_id | to_story_id | relation | note | created_at
```

---

### 2. GASをデプロイする

1. `SF_Library_UserData` を開く
2. 拡張機能 → Apps Script
3. `gas/Code.gs` の内容を貼り付け・保存
4. デプロイ → 新しいデプロイ
   - 種類：ウェブアプリ
   - 実行ユーザー：自分
   - アクセス：**全員**
5. デプロイURLをコピー

---

### 3. GAS URLを設定する

`src/config.js` を開き、`GAS_URL` にデプロイURLを貼り付けます。

```js
export const GAS_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

---

### 4. GitHub Pagesで公開する

1. このリポジトリを GitHub にプッシュ
2. Settings → Pages → Source: `main` ブランチ、`/ (root)`
3. 公開されたURLにアクセス

---

## ジャンルタグ一覧

| タグ名 | 表示色 |
|--------|--------|
| サイバーパンク | 緑 |
| スペースオペラ | 紫 |
| ファーストコンタクト | 金 |
| ディストピア | 赤 |
| AI・意識 | 水色 |
| ニュー・ウィーブ | ピンク |

新しいジャンルを追加する場合は `src/config.js` の `GENRE_MAP` と
`styles/components.css` の `.gt-*` に対応するスタイルを追加してください。

---

## リンクの関係タイプ

| タイプ | 線種 | 意味 |
|--------|------|------|
| 同一世界観 | 実線（矢印なし） | 共通の設定・世界観 |
| 影響元 | 点線＋矢印 | 影響を受けた元作品 |
| オマージュ | 実線＋矢印 | 意図的な引用・参照 |
| 引用・参照 | 短点線＋矢印 | 作中での具体的な言及 |