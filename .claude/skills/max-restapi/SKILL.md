---
name: max-restapi
description: Max 9 パッチャーを HTTP REST API で操作するスキル。オブジェクトの追加・削除・接続・属性変更・メッセージ送信などを curl や HTTP クライアントから行う。Max パッチを外部プログラムから制御する場合に使用する。
compatibility: Requires Max 9 with node.script, or standalone mode for development/testing.
metadata:
  author: m4fg
  version: "1.0"
---

# max-restapi

Max 9 の `node.script` 上で動作する Express REST API サーバ。
HTTP リクエストで Max パッチャー内のオブジェクトを操作できる。

## 基本情報

- **ベース URL**: `http://localhost:3009`
- **ポート**: デフォルト `3009`（環境変数 `PORT` で変更可能）
- **Content-Type**: リクエストボディには `application/json` を指定
- **レスポンス形式**: すべて JSON

## エンドポイント

### ヘルスチェック

```
GET /
```

```bash
curl http://localhost:3009/
# => { "status": "ok" }
```

### クエリ（読み取り）

#### 全オブジェクト取得

```
GET /objects
```

パッチ内の全オブジェクトとパッチラインを返す。

```bash
curl http://localhost:3009/objects
```

レスポンス例:

```json
{
  "results": {
    "boxes": [
      { "box": { "maxclass": "newobj", "varname": "osc1", "patching_rect": [100,200,80,22], "text": "cycle~ 440" } }
    ],
    "lines": []
  }
}
```

#### 選択中オブジェクト取得

```
GET /objects/selected
```

Max エディタ上で選択中のオブジェクトを返す。レスポンス形式は `/objects` と同じ。

#### オブジェクト属性取得

```
GET /objects/:varname/attributes
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `varname` | string (path) | オブジェクトの varname |

```bash
curl http://localhost:3009/objects/osc1/attributes
# => { "results": { "patching_rect": [100,200,80,22], "maxclass": "newobj" } }
```

#### バウンディングボックス取得

```
GET /objects/bounds
```

全オブジェクトを囲む最小矩形 `[left, top, right, bottom]` を返す。
新規オブジェクトの配置位置を決める際に使う。

```bash
curl http://localhost:3009/objects/bounds
# => { "results": [50, 80, 400, 350] }
```

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
curl "http://localhost:3009/console?level=error"
curl "http://localhost:3009/console?since_last_call=true"
```

レスポンス例:

```json
{
  "messages": [
    { "id": 0, "level": "error", "message": "error: cycle~ bad inlet index", "timestamp": "2026-02-17T12:00:00.000Z" }
  ],
  "overflow": false
}
```

- `overflow: true`: バッファ上限（1000件）超過で古いメッセージが失われた
- standalone モード: `{ messages: [], overflow: false }`

### ミューテーション（書き込み）

#### オブジェクト追加

```
POST /objects
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `obj_type` | string | yes | オブジェクト種類（`cycle~`, `message`, `number` 等） |
| `position` | [x, y] | yes | 配置座標 |
| `varname` | string | yes | 一意な識別名 |
| `args` | string | no | オブジェクト引数（例: `"440"`） |

```bash
curl -X POST http://localhost:3009/objects \
  -H "Content-Type: application/json" \
  -d '{"obj_type":"cycle~","position":[100,200],"varname":"osc1","args":"440"}'
# => { "ok": true }
```

#### オブジェクト削除

```
DELETE /objects/:varname
```

```bash
curl -X DELETE http://localhost:3009/objects/osc1
# => { "ok": true }
```

#### 接続

```
POST /connections
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `src_varname` | string | yes | 接続元 varname |
| `dst_varname` | string | yes | 接続先 varname |
| `outlet_idx` | number | no | アウトレット番号（デフォルト: 0） |
| `inlet_idx` | number | no | インレット番号（デフォルト: 0） |

```bash
curl -X POST http://localhost:3009/connections \
  -H "Content-Type: application/json" \
  -d '{"src_varname":"osc1","dst_varname":"dac1","outlet_idx":0,"inlet_idx":0}'
# => { "ok": true }
```

#### 接続解除

```
DELETE /connections
```

ボディは `POST /connections` と同じ形式。

```bash
curl -X DELETE http://localhost:3009/connections \
  -H "Content-Type: application/json" \
  -d '{"src_varname":"osc1","dst_varname":"dac1","outlet_idx":0,"inlet_idx":0}'
```

#### 属性変更

```
PATCH /objects/:varname/attributes
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `attr_name` | string | yes | 属性名 |
| `attr_value` | any | yes | 設定する値 |

```bash
curl -X PATCH http://localhost:3009/objects/osc1/attributes \
  -H "Content-Type: application/json" \
  -d '{"attr_name":"patching_rect","attr_value":[200,300,80,22]}'
```

#### テキスト設定

```
PATCH /objects/:varname/text
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `new_text` | string | yes | メッセージボックスに設定するテキスト |

```bash
curl -X PATCH http://localhost:3009/objects/msg1/text \
  -H "Content-Type: application/json" \
  -d '{"new_text":"hello world"}'
```

#### メッセージ送信

```
POST /objects/:varname/message
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `message` | string | yes | 送信するメッセージ |

```bash
curl -X POST http://localhost:3009/objects/osc1/message \
  -H "Content-Type: application/json" \
  -d '{"message":"frequency 880"}'
```

#### bang 送信

```
POST /objects/:varname/bang
```

ボディ不要。

```bash
curl -X POST http://localhost:3009/objects/osc1/bang
```

#### ナンバー値設定

```
PATCH /objects/:varname/number
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `num` | number | yes | 設定する数値 |

```bash
curl -X PATCH http://localhost:3009/objects/num1/number \
  -H "Content-Type: application/json" \
  -d '{"num":440}'
```

## エラーレスポンス

| ステータス | 意味 | 例 |
|-----------|------|-----|
| 400 | 必須パラメータ不足 | `{"error":"missing required fields: obj_type, position, varname"}` |
| 504 | Max ブリッジ応答タイムアウト | `{"error":"timeout waiting for Max response"}` |

## ワークフロー例: シンプルなシンセを構築

```bash
# 1. オシレータを追加
curl -X POST http://localhost:3009/objects \
  -H "Content-Type: application/json" \
  -d '{"obj_type":"cycle~","position":[100,100],"varname":"osc1","args":"440"}'

# 2. DAC を追加
curl -X POST http://localhost:3009/objects \
  -H "Content-Type: application/json" \
  -d '{"obj_type":"ezdac~","position":[100,200],"varname":"dac1"}'

# 3. 左チャンネル接続
curl -X POST http://localhost:3009/connections \
  -H "Content-Type: application/json" \
  -d '{"src_varname":"osc1","dst_varname":"dac1","outlet_idx":0,"inlet_idx":0}'

# 4. 右チャンネル接続
curl -X POST http://localhost:3009/connections \
  -H "Content-Type: application/json" \
  -d '{"src_varname":"osc1","dst_varname":"dac1","outlet_idx":0,"inlet_idx":1}'
```

## 注意事項

- `varname` はオブジェクトの一意な識別子。すべての操作で使用する
- `outlet_idx` / `inlet_idx` は省略時デフォルト 0
- Max 環境外ではインメモリのモック状態で動作する（開発・テスト用）
- パッチライン（`lines`）列挙は Max v8 API の制約により常に空配列
