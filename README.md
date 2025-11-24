## セットアップ

#### UWorld Chrome をダウンロード

[📥 UWorld Chrome.app](public/UWorld%20Chrome.app)

#### 依存関係のインストール

```sh
npm install
```

## 実行

#### UWorld から情報を取得して JSON を作成

UWorld Chrome をダブルクリックしてブラウザを起動

```sh
npm start
```

#### JSON から markdown の要約を作成

```sh
npm run gen:md
```

#### TypeScript をコンパイルしてから実行

```sh
npm run build
node dist/extract.js
```

## 開発

#### フォーマット

```sh
npm run format
```

#### リント

```sh
npm run lint
```

#### フォーマットとリントを同時に実行

```sh
npm run check
```
