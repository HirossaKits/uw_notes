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

export type BoundingBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function getBoundingBox(polygons: number[][]): BoundingBox {
  const xs = polygons.map((p) => p.filter((_, i) => i % 2 === 0)).flat();
  const ys = polygons.map((p) => p.filter((_, i) => i % 2 === 1)).flat();
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

export async function clipPngFromPdf(
  pdfPath: string,
  page: number,
  boundingBox: BoundingBox,
  outputPath: string
) {
  // PDF 読み込み
  const loadingTask = getDocument(pdfPath);
  const pdf = await loadingTask.promise;
  const pdfPage = await pdf.getPage(page);

  // ページを画像としてレンダリング
  const scale = 2.0;
  const viewport = pdfPage.getViewport({ scale });
  const canvasFactory = new NodeCanvasFactory();
  const canvas = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: canvas.context,
    viewport,
    canvas: null,
  } as unknown as Parameters<typeof pdfPage.render>[0];

  await pdfPage.render(renderContext).promise;

  const buffer = canvas.canvas.toBuffer('image/png');

  // polygon (インチ単位) → ピクセル座標に変換
  // PDFは72 DPI (1インチ = 72ポイント)
  // ピクセル = インチ × 72 × scale
  const DPI = 72;
  const inchesToPixels = (inches: number) => inches * DPI * scale;

  // inch -> pixel座標に変換
  const left = Math.floor(inchesToPixels(boundingBox.left));
  const top = Math.floor(inchesToPixels(boundingBox.top));
  const right = Math.ceil(inchesToPixels(boundingBox.right));
  const bottom = Math.ceil(inchesToPixels(boundingBox.bottom));
  const width = right - left;
  const height = bottom - top;

  // sharp で切り抜き
  await sharp(buffer)
    .extract({ left, top, width, height })
    .png()
    .toFile(outputPath);

  return outputPath;
}
