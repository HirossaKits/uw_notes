## セットアップ

依存関係のインストール

```sh
npm install
```

Playwright のブラウザをインストール

```sh
npx playwright install
```

## 実行

UWorld から情報を取得して JSON を作成

```sh
npm start
```

JSON から markdown の要約を作成

```sh
npm run gen:md
```

TypeScript をコンパイルしてから実行

```sh
npm run build
node dist/extract.js
```

## コード品質

フォーマット

```sh
npm run format
```

リント

```sh
npm run lint
```

フォーマットとリントを同時に実行

```sh
npm run check
```
