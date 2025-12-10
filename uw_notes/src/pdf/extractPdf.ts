import sharp from "sharp";
import { createCanvas, Image } from "@napi-rs/canvas";
// legacyビルドを使用（Node.js環境用）
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Node.js環境でImageをグローバルに設定
// @napi-rs/canvasのImageをpdfjs-distが使用できるようにする
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Image === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Image = Image;
}

export class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export async function extractPngFromPdf(
  pdfPath: string,
  page: number,
  polygon: number[],
  outputPath: string
) {
  // PDF 読み込み
  const loadingTask = getDocument(pdfPath);
  const pdf = await loadingTask.promise;
  const pdfPage = await pdf.getPage(page);

  // ページを画像としてレンダリング
  const viewport = pdfPage.getViewport({ scale: 2.0 });
  const canvasFactory = new NodeCanvasFactory();
  const canvas = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: canvas.context,
    viewport,
    canvas: null,
  } as unknown as Parameters<typeof pdfPage.render>[0];

  await pdfPage.render(renderContext).promise;

  const buffer = canvas.canvas.toBuffer('image/png');

  // polygon → 最小矩形に変換
  const xs = [polygon[0], polygon[2], polygon[4], polygon[6]];
  const ys = [polygon[1], polygon[3], polygon[5], polygon[7]];

  const left = Math.floor(Math.min(...xs));
  const top = Math.floor(Math.min(...ys));
  const width = Math.ceil(Math.max(...xs) - left);
  const height = Math.ceil(Math.max(...ys) - top);

  // sharp で切り抜き
  await sharp(buffer)
    .extract({ left, top, width, height })
    .png()
    .toFile(outputPath);

  return outputPath;
}
