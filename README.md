## セットアップ

依存関係のインストール:

```sh
npm install
```

Playwright のブラウザをインストール:

```sh
npx playwright install
```

## 実行

TypeScript を直接実行（推奨）:

```sh
npm run dev
# または
npm start
```

TypeScript をコンパイルしてから実行:

```sh
npm run build
node dist/extract.js
```

## コード品質

フォーマット:

```sh
npm run format
```

リント:

```sh
npm run lint
```

フォーマットとリントを同時に実行（推奨）:

```sh
npm run check
```
