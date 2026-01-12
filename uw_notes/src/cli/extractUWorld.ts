import { findUWorldPage } from "@/browser/findUWorldTab";
import { extractUWorldReviewFromPreviousTests } from "@/extract/extractUWorld";
import { saveExtraction } from "@/extract/saveExtraction";
import { connectToChrome } from "@/browser/connect";

export async function extractUWorld() {
  try {
    // 1. 既存の Chrome に接続
    const browser = await connectToChrome({ host: '127.0.0.1', port: 9222 });

    // 2. UWorld タブを探す
    const page = await findUWorldPage(browser);
    await page.bringToFront();

    // 3. 抽出（Review 画面 1問分）
    const extractions = await extractUWorldReviewFromPreviousTests(page);

    // 4. 保存（question.json）
    for (const extraction of extractions.flat()) {
      saveExtraction(extraction);
      console.log(
        `Done: questionId=${extraction.questionId}`,
      );
    }
  } catch (e) {
    console.error('Error during extraction:', (e as Error).message);
    process.exit(1);
  }
}

extractUWorld().catch(console.error);