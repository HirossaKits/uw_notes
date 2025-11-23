import { connectToChrome } from '@/extractor/connect';
import { findUWorldPage } from '@/extractor/findUWorldTab';
import { extractUWorldReview } from '@/extractor/extractUWorldReview';
import { saveExtraction } from '@/output/save';

async function main() {
  try {
    const browser = await connectToChrome(9222);
    const page = await findUWorldPage(browser);

    const result = await extractUWorldReview(page);
    const id = `uw_${Date.now()}`;
    saveExtraction(id, result);

    console.log('Extraction complete.');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

main();
