import { connectToChrome } from './extractor/connect';
import { findUWorldPage } from './extractor/findUWorldTab';
import { extractUWorldReview } from './extractor/extractUWorldReview';
import { saveExtraction } from './output/save';

async function main() {
  try {
    // 1. 既存の Chrome に接続
    const browser = await connectToChrome({ host: '127.0.0.1', port: 9222 });

    // 2. UWorld タブを探す
    const page = await findUWorldPage(browser);
    await page.bringToFront();

    // 3. 抽出（Review 画面 1問分）
    const extraction = await extractUWorldReview(page);

    // 4. 保存（question.json）
    saveExtraction(extraction);

    console.log(
      `Done: questionId=${extraction.questionId}`,
    );
  } catch (e) {
    console.error('Error during extraction:', (e as Error).message);
    process.exit(1);
  }
}

main();
