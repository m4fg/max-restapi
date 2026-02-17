# max-restapi

Max 9 の `node.script` から起動する Express REST API サーバ。

外部クライアントから HTTP リクエストで Max パッチャーを操作できる。

## アーキテクチャ

```
HTTP Client (curl等)
    ↓ REST API
[node.script index.js]  ← Express サーバ (port 3009)
    ↓ outlet 0
[route query]            ← メッセージ種別で分岐
    ↓ query          ↓ else (script等)
[v8 bridge.js]      [thispatcher]
    ↓ response
[node.script inlet]  ← addHandler("response") で受信
```

### メッセージフローの仕組み

Max の `node.script` は Node.js を実行するが、Max パッチャーへの直接アクセス手段を持たない。
そのため、操作の種類に応じて2つの経路を使い分ける:

**ミューテーション（書き込み）** — `thispatcher` スクリプトコマンド経由

`node.script` の `outlet()` で `script new ...` 等の Max メッセージをトークン分割して送信。
`thispatcher` がスクリプトコマンドとして解釈・実行する。

```javascript
// patcher.js — 正しい送り方（トークン分割）
maxApi.outlet("script", "new", varname, type, ...args);
```

**クエリ（読み取り）** — `js bridge.js` 経由

`node.script` は `outlet("query", requestId, action, ...args)` を送信。
`route query` で分岐し、`v8` オブジェクトの `bridge.js` が `this.patcher` API でパッチャーを走査。
結果を JSON 化して `node.script` の inlet に `response {JSON}` として返送。
Node.js 側は `addHandler("response", ...)` で `request_id` を照合して Promise を解決する。

### 重要な制約

- **`node.script` に JSON 文字列を直接送ってはいけない**
  `thispatcher` は Max スクリプトコマンドしか理解しない。`JSON.stringify()` した文字列を `outlet()` で送ると `patcher: doesn't understand "..."` エラーになる。
- **`node.script` と `v8` は別物**
  `node.script` = Node.js 環境（Express等が使える、`this.patcher` にアクセス不可）。
  `v8` = Max 9 の V8 JavaScript 環境（`this.patcher` でパッチャー操作可能、npm パッケージは使えない）。
- **Max メッセージのアトム分割に注意**
  `outlet()` の引数はそれぞれ独立した Max アトムになる。スペースを含む文字列は単一シンボルとして扱われるが、パッチコードを経由する際の挙動に注意。
- **`bridge.js` の patchline 列挙は未実装**
  Max の `v8`/`js` API にはパッチコードを直接列挙する標準的な方法がないため、`lines` は空配列を返す。

## プロジェクト構成

```
max-restapi/
├── index.js              # Express サーバ起動
├── max.js                # max-api セットアップ + queryMax (リクエスト/レスポンス相関)
├── patcher.js            # thispatcher スクリプトコマンド送信 + スタンドアロン用モック
├── routes.js             # REST API エンドポイント定義
├── bridge.js             # Max v8 ブリッジ
├── max-restapi.maxpat    # Max パッチ
└── package.json
```

## 技術スタック

- **JavaScript** (ESM)
- **Express 5** - REST API フレームワーク
- **max-api** - Max ↔ Node.js ブリッジ（node.script 環境で自動提供）
- **Max JavaScript** (`v8` オブジェクト) - パッチャークエリ用ブリッジ（V8 エンジン、モダン JS 対応）

## セットアップ

```bash
npm install
```

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm start` | サーバを起動 |

## API エンドポイント

### ヘルスチェック

```
GET /
```

### クエリ

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/objects` | パッチ内の全オブジェクトを取得 |
| GET | `/objects/selected` | 選択中のオブジェクトを取得 |
| GET | `/objects/:varname/attributes` | オブジェクトの属性を取得 |
| GET | `/objects/bounds` | オブジェクトの配置領域（バウンディングボックス）を取得 |
| GET | `/console` | Max コンソールメッセージを取得 |

#### コンソールメッセージ取得

```
GET /console?level=info&since_last_call=false
```

Max コンソール（Max 窓）のメッセージを取得する。パッチ内の `console` オブジェクトでキャプチャしたメッセージをバッファから返す。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `level` | string (query) | `"info"` | フィルタレベル: `"error"`, `"warning"`, `"info"`。指定レベル以上を返す |
| `since_last_call` | string (query) | `"false"` | `"true"` で前回取得以降のメッセージのみ返す |

```bash
# エラーメッセージのみ取得
curl "http://localhost:3009/console?level=error"

# 前回以降の全メッセージを取得
curl "http://localhost:3009/console?since_last_call=true"
```

レスポンス例:

```json
{
  "messages": [
    { "id": 0, "level": "error", "message": "error: cycle~ bad inlet index", "timestamp": "2026-02-17T12:00:00.000Z" },
    { "id": 1, "level": "info", "message": "print: hello", "timestamp": "2026-02-17T12:00:01.000Z" }
  ],
  "overflow": false
}
```

- `overflow: true` はバッファ上限（1000件）超過で古いメッセージが失われたことを示す
- standalone モードでは常に `{ messages: [], overflow: false }` を返す

### ミューテーション

| メソッド | パス | 説明 | 必須パラメータ |
|---------|------|------|--------------|
| POST | `/objects` | オブジェクトを追加 | `obj_type`, `position`, `varname` |
| DELETE | `/objects/:varname` | オブジェクトを削除 | - |
| POST | `/connections` | オブジェクト間を接続 | `src_varname`, `dst_varname` |
| DELETE | `/connections` | 接続を解除 | `src_varname`, `dst_varname` |
| PATCH | `/objects/:varname/attributes` | 属性を変更 | `attr_name`, `attr_value` |
| PATCH | `/objects/:varname/text` | メッセージボックスのテキストを設定 | `new_text` |
| POST | `/objects/:varname/message` | オブジェクトにメッセージを送信 | `message` |
| POST | `/objects/:varname/bang` | オブジェクトにbangを送信 | - |
| PATCH | `/objects/:varname/number` | ナンバー値を設定 | `num` |

### 使用例

```bash
# パッチ内のオブジェクト一覧
curl http://localhost:3009/objects

# cycle~ オブジェクトを追加
curl -X POST http://localhost:3009/objects \
  -H "Content-Type: application/json" \
  -d '{"obj_type":"cycle~","position":[100,200],"varname":"osc1","args":"440"}'

# オブジェクト間を接続
curl -X POST http://localhost:3009/connections \
  -H "Content-Type: application/json" \
  -d '{"src_varname":"osc1","dst_varname":"dac1","outlet_idx":0,"inlet_idx":0}'

# bangを送信
curl -X POST http://localhost:3009/objects/osc1/bang
```

## 動作モード

### node.script 内（Max 環境）

ミューテーション操作は `thispatcher` スクリプトメッセージを `outlet()` 経由で直接送信する。

- `outlet("script", "new", varname, type, ...args)` - オブジェクト作成
- `outlet("script", "delete", varname)` - オブジェクト削除
- `outlet("script", "connect", src, outIdx, dst, inIdx)` - 接続
- `outlet("script", "disconnect", src, outIdx, dst, inIdx)` - 切断
- `outlet("script", "send", varname, message)` - メッセージ送信
- `outlet("script", "sendbox", varname, attr, value)` - 属性変更

クエリ操作は `outlet("query", requestId, action, ...args)` でリクエストを送信し、`addHandler("response", ...)` で request_id を照合してレスポンスを返す。

### スタンドアロン（開発・テスト）

`max-api` なしでも起動可能。インメモリのパッチャー状態を保持し、オブジェクトの追加・削除・接続・クエリが実際に動作する。

## Max での使い方

Max パッチ (`max-restapi.maxpat`) を開き、`script npm install` → `script start` の順にクリック。

ポートはデフォルト `3009`。環境変数 `PORT` で変更可能。

## エンドポイント変更時のルール

エンドポイントを追加・変更・削除した場合、以下の3ファイルを**必ず**同時に更新すること:

1. `README.md` — 本ファイルの API エンドポイントセクション
2. `.agent/skills/max-restapi/SKILL.md` — Agent Skills 定義
3. `.claude/skills/max-restapi/SKILL.md` — Agent Skills 定義（Claude Code 用）
