import { findUWorldPage } from "@/browser/findUWorldTab";
import { extractUWorldReviewFromPreviousTests } from "@/extract/extractUWorld";
import { saveExtraction } from "@/extract/saveExtraction";
import { connectToChrome } from "@/browser/connect";
import dotenv from "dotenv";

dotenv.config();

export async function extractUWorld() {
  try {
    // 既存の Chrome に接続
    const browser = await connectToChrome({ host: '127.0.0.1', port: 9222 });

    // UWorld タブを探す
    const page = await findUWorldPage(browser);
    await page.bringToFront();

    // Previous Tests ページに移動
    await page.goto(process.env.PREVIOUS_TESTS_URL);
    await page.waitForLoadState('networkidle');
    await new Promise((r) => setTimeout(r, 1000));

    // 抽出処理
    await extractUWorldReviewFromPreviousTests(page);

    console.log('🎉 Extraction completed');
  } catch (e) {
    console.error('Error during extraction:', (e as Error).message);
    process.exit(1);
  }
}

extractUWorld().catch(console.error);